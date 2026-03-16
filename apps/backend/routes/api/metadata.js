const express = require("express");

const router = express.Router();

const { listDiskDatasetKeys, getDiskDataset } = require("../../data/diskDatasets");
const { readMetadataStore, makeMetadataKey, upsertMetadataRecord } = require("../../data/metadataStore");
const {
  getMetadataProvider,
  listMetadataProviders,
} = require("../../services/metadata/providerRegistry");
const { downloadMetadataImages } = require("../../services/metadata/imageDownloader");
const { saveManualImageUpload } = require("../../services/metadata/manualMetadataAssets");
const {
  enqueueMetadataJob,
  getMetadataJob,
  listMetadataJobs,
} = require("../../services/metadata/metadataWorker");

const ALLOWED_JOB_TYPES = new Set(["scrapeAllMissing", "scrapeAll", "scrapeDisk", "scrapeGame"]);

function parseBoolean(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return defaultValue;
}

function coerceLookupInput(input = {}) {
  return {
    gameName: String(input.gameName ?? input.q ?? "").trim(),
    provider: String(input.provider || process.env.METADATA_DEFAULT_PROVIDER || "hybrid").trim(),
    dataset: input.dataset ? String(input.dataset).trim() : null,
    diskId: input.diskId != null && String(input.diskId).trim() !== "" ? input.diskId : null,
    options: input.options && typeof input.options === "object" ? input.options : {},
    persist: parseBoolean(input.persist, true),
    downloadImages: parseBoolean(input.downloadImages, false),
  };
}

function parseInteger(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

async function fetchTheGamesDbRawSearch({ q, page = 1 }) {
  const publicKey = process.env.THEGAMESDB_PUBLIC_KEY;
  if (!publicKey) {
    return { ok: false, status: 400, error: "THEGAMESDB_PUBLIC_KEY is not configured" };
  }

  const baseUrl = process.env.THEGAMESDB_BASE_URL || "https://api.thegamesdb.net/v1.1";
  const normalizedBaseUrl = String(baseUrl).endsWith("/") ? String(baseUrl) : `${baseUrl}/`;
  const url = new URL("Games/ByGameName", normalizedBaseUrl);
  url.searchParams.set("apikey", publicKey);
  url.searchParams.set("name", q);
  url.searchParams.set("fields", "players,genres,overview,developers,publishers");
  url.searchParams.set("include", "boxart,genres,developers,publishers");
  url.searchParams.set("page", String(Math.max(1, page)));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "FloppyStack64-MetadataWorker/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, error: `http_${response.status}` };
    }

    const payload = await response.json();
    return { ok: true, status: 200, payload };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error.name === "AbortError" ? "timeout" : "error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runSingleLookup(input) {
  const providerName = String(input.provider || "hybrid").toLowerCase();
  const provider = getMetadataProvider(providerName);
  const knownProviders = listMetadataProviders();
  const providerExists = knownProviders.includes(providerName);

  if (!providerExists) {
    return {
      status: 400,
      body: { error: "Unknown provider", provider: providerName, allowed: knownProviders },
    };
  }

  if (!input.gameName) {
    return {
      status: 400,
      body: { error: "gameName (or q) is required" },
    };
  }

  const gameRef = {
    platform: "c64",
    gameName: input.gameName,
    dataset: input.dataset || undefined,
    diskId: input.diskId || undefined,
    metadataKey: makeMetadataKey({ platform: "c64", gameName: input.gameName }),
  };

  console.log("[metadata.lookup] start", {
    gameName: input.gameName,
    provider: providerName,
    persist: input.persist,
    downloadImages: input.downloadImages,
    dataset: input.dataset || null,
    diskId: input.diskId || null,
  });

  const metadata = await provider.fetchGameMetadata(gameRef, input.options || {});
  let stored = null;
  let downloads = null;

  console.log("[metadata.lookup] provider result", {
    gameName: input.gameName,
    found: Boolean(metadata?.found),
    sourceProvider: metadata?.source?.provider || providerName,
    sourceStatus: metadata?.source?.status || null,
    sourceId: metadata?.source?.sourceId || null,
    canonicalTitle: metadata?.canonicalTitle || null,
  });

  if (metadata && metadata.found && input.downloadImages) {
    downloads = await downloadMetadataImages(metadata);
    console.log("[metadata.lookup] image downloads", {
      gameName: input.gameName,
      downloads: Object.fromEntries(
        Object.entries(downloads || {}).map(([key, value]) => [
          key,
          value
            ? {
                ok: Boolean(value.ok),
                status: value.status || "ok",
                publicUrl: value.publicUrl || null,
              }
            : null,
        ])
      ),
    });
  }

  if (metadata && input.persist) {
    stored = await upsertMetadataRecord({
      key: gameRef.metadataKey,
      platform: "c64",
      gameName: input.gameName,
      canonicalTitle: metadata?.canonicalTitle ?? input.gameName,
      description: metadata?.description ?? null,
      genre: metadata?.genre ?? null,
      developer: metadata?.developer ?? null,
      publisher: metadata?.publisher ?? null,
      year: metadata?.year ?? null,
      players: metadata?.players ?? null,
      images: metadata?.images || {},
      source:
        metadata?.source || {
          provider: providerName,
          status: "not_found",
          matchConfidence: null,
          lastFetchedAt: new Date().toISOString(),
        },
    });
    console.log("[metadata.lookup] stored", {
      key: stored?.key || gameRef.metadataKey,
      provider: stored?.source?.provider || null,
      status: stored?.source?.status || null,
      updatedAt: stored?.updatedAt || null,
    });
  }

  return {
    status: 200,
    body: {
      request: {
        gameName: input.gameName,
        provider: providerName,
        dataset: input.dataset || null,
        diskId: input.diskId || null,
        persist: input.persist,
        downloadImages: input.downloadImages,
      },
      metadataKey: gameRef.metadataKey,
      found: Boolean(metadata?.found),
      result: metadata || null,
      downloads,
      stored,
    },
  };
}

function providerHealthSummary() {
  const hasScreenScraperDevCreds = Boolean(
    process.env.SCREENSCRAPER_DEV_ID &&
      process.env.SCREENSCRAPER_DEV_PASSWORD &&
      process.env.SCREENSCRAPER_SOFTNAME
  );
  const hasScreenScraperUserCreds = Boolean(
    process.env.SCREENSCRAPER_USER_ID && process.env.SCREENSCRAPER_USER_PASSWORD
  );
  const hasScreenScraperCoreCreds = hasScreenScraperDevCreds || hasScreenScraperUserCreds;

  const hasApiEndpoint = Boolean(process.env.METADATA_API_ENDPOINT);
  const hasTheGamesDbKey = Boolean(process.env.THEGAMESDB_PUBLIC_KEY);
  const hasScraperTemplate = Boolean(process.env.METADATA_SCRAPER_URL_TEMPLATE);

  return {
    defaultProvider: process.env.METADATA_DEFAULT_PROVIDER || "hybrid",
    mockFallbackEnabled:
      String(process.env.METADATA_ENABLE_MOCK_FALLBACK || "true").toLowerCase() !== "false",
    providers: {
      screenscraper: {
        configured: hasScreenScraperCoreCreds,
        needs: ["SCREENSCRAPER_DEV_ID", "SCREENSCRAPER_DEV_PASSWORD", "SCREENSCRAPER_SOFTNAME"],
        hasDevCredentials: hasScreenScraperDevCreds,
        hasUserCredentials: hasScreenScraperUserCreds,
        usingUserCredentialsFallback: !hasScreenScraperDevCreds && hasScreenScraperUserCreds,
        systemIdC64: process.env.SCREENSCRAPER_SYSTEM_ID_C64 || "66",
      },
      api: {
        configured: hasApiEndpoint,
        needs: ["METADATA_API_ENDPOINT"],
        endpointConfigured: hasApiEndpoint,
      },
      thegamesdb: {
        configured: hasTheGamesDbKey,
        needs: ["THEGAMESDB_PUBLIC_KEY"],
        publicKeyConfigured: hasTheGamesDbKey,
        baseUrl: process.env.THEGAMESDB_BASE_URL || "https://api.thegamesdb.net/v1.1",
        platformIdC64: process.env.THEGAMESDB_PLATFORM_ID_C64 || null,
        platformIdsC64:
          String(process.env.THEGAMESDB_PLATFORM_IDS_C64 || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean).length > 0
            ? String(process.env.THEGAMESDB_PLATFORM_IDS_C64 || "")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : ["40"],
      },
      scraper: {
        configured: hasScraperTemplate,
        needs: ["METADATA_SCRAPER_URL_TEMPLATE"],
        urlTemplateConfigured: hasScraperTemplate,
      },
      hybrid: {
        configured: hasScreenScraperCoreCreds || hasTheGamesDbKey || hasApiEndpoint || hasScraperTemplate,
        strategy: ["screenscraper", "thegamesdb", "api", "scraper", "mock (optional fallback)"],
      },
    },
  };
}

router.get("/health", (_req, res) => {
  res.json(providerHealthSummary());
});

router.get("/providers", (_req, res) => {
  res.json({
    providers: listMetadataProviders(),
    datasets: listDiskDatasetKeys(),
    jobTypes: Array.from(ALLOWED_JOB_TYPES),
  });
});

router.get("/lookup", async (req, res) => {
  try {
    const lookup = coerceLookupInput(req.query || {});
    const output = await runSingleLookup(lookup);
    return res.status(output.status).json(output.body);
  } catch (error) {
    console.error("Single metadata lookup failed:", error);
    return res.status(500).json({ error: "Single metadata lookup failed" });
  }
});

router.post("/lookup", async (req, res) => {
  try {
    const lookup = coerceLookupInput(req.body || {});
    const output = await runSingleLookup(lookup);
    return res.status(output.status).json(output.body);
  } catch (error) {
    console.error("Single metadata lookup failed:", error);
    return res.status(500).json({ error: "Single metadata lookup failed" });
  }
});

router.post("/manual", async (req, res) => {
  try {
    const body = req.body || {};
    const gameName = normalizeNullableString(body.gameName);
    if (!gameName) {
      return res.status(400).json({ error: "gameName is required" });
    }

    const platform = normalizeNullableString(body.platform) || "c64";
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const images = body.images && typeof body.images === "object" ? { ...body.images } : {};
    const uploads = body.uploads && typeof body.uploads === "object" ? body.uploads : {};

    const uploadResults = {};
    if (uploads.boxFront?.dataUrl) {
      const saved = await saveManualImageUpload({
        gameName,
        platform,
        imageKey: "boxFront",
        dataUrl: uploads.boxFront.dataUrl,
      });
      images.boxFront = saved.publicUrl;
      uploadResults.boxFront = saved;
    }

    const now = new Date().toISOString();
    const stored = await upsertMetadataRecord({
      key: makeMetadataKey({ platform, gameName }),
      platform,
      gameName,
      canonicalTitle: normalizeNullableString(metadata.canonicalTitle) || gameName,
      description:
        Object.prototype.hasOwnProperty.call(metadata, "description")
          ? (metadata.description == null ? null : String(metadata.description))
          : undefined,
      genre: Object.prototype.hasOwnProperty.call(metadata, "genre")
        ? normalizeNullableString(metadata.genre)
        : undefined,
      developer: Object.prototype.hasOwnProperty.call(metadata, "developer")
        ? normalizeNullableString(metadata.developer)
        : undefined,
      publisher: Object.prototype.hasOwnProperty.call(metadata, "publisher")
        ? normalizeNullableString(metadata.publisher)
        : undefined,
      year: Object.prototype.hasOwnProperty.call(metadata, "year")
        ? normalizeNullableString(metadata.year)
        : undefined,
      players: Object.prototype.hasOwnProperty.call(metadata, "players")
        ? normalizeNullableString(metadata.players)
        : undefined,
      images: {
        ...(Object.prototype.hasOwnProperty.call(images, "boxFront") ? { boxFront: images.boxFront || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(images, "label") ? { label: images.label || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(images, "screenshot") ? { screenshot: images.screenshot || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(images, "logo") ? { logo: images.logo || null } : {}),
      },
      source: {
        provider: "manual",
        status: "manual",
        matchConfidence: 1,
        sourceId: normalizeNullableString(body.sourceId),
        lastFetchedAt: now,
      },
    });

    console.log("[metadata.manual] saved", {
      gameName,
      key: stored?.key,
      uploadedBoxFront: Boolean(uploadResults.boxFront),
      boxFrontUrl: stored?.images?.boxFront || null,
    });

    return res.json({
      ok: true,
      stored,
      uploads: uploadResults,
    });
  } catch (error) {
    console.error("Manual metadata save failed:", error);
    return res.status(500).json({ error: "Manual metadata save failed" });
  }
});

router.get("/thegamesdb/search", async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const page = Math.max(1, parseInteger(req.query?.page, 1));
    const limit = Math.max(1, Math.min(100, parseInteger(req.query?.limit, 25)));

    if (!q) return res.status(400).json({ error: "q is required" });

    const raw = await fetchTheGamesDbRawSearch({ q, page });
    if (!raw.ok) {
      return res.status(raw.status || 500).json({ error: raw.error || "TheGamesDB search failed" });
    }

    const games = Array.isArray(raw.payload?.data?.games) ? raw.payload.data.games : [];
    const summary = games.slice(0, limit).map((game) => ({
      id: game?.id ?? null,
      title: game?.game_title ?? game?.name ?? null,
      platform: game?.platform ?? null,
      release_date: game?.release_date ?? null,
      region_id: game?.region_id ?? null,
      country_id: game?.country_id ?? null,
      developers: game?.developers ?? null,
      publishers: game?.publishers ?? null,
    }));

    const uniquePlatforms = Array.from(
      new Set(summary.map((game) => (game.platform == null ? null : String(game.platform))).filter(Boolean))
    ).sort((a, b) => Number(a) - Number(b));

    return res.json({
      q,
      page,
      total: raw.payload?.data?.count ?? games.length,
      returned: summary.length,
      uniquePlatforms,
      results: summary,
    });
  } catch (error) {
    console.error("TheGamesDB debug search failed:", error);
    return res.status(500).json({ error: "TheGamesDB debug search failed" });
  }
});

router.get("/jobs", async (_req, res) => {
  const jobs = await listMetadataJobs();
  res.json(jobs);
});

router.get("/jobs/:id", async (req, res) => {
  const job = await getMetadataJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

router.post("/jobs", async (req, res) => {
  try {
    const {
      type = "scrapeAllMissing",
      dataset = "default",
      provider = process.env.METADATA_DEFAULT_PROVIDER || "hybrid",
      diskId = null,
      gameName = null,
      options = {},
    } = req.body || {};

    if (!ALLOWED_JOB_TYPES.has(type)) {
      return res.status(400).json({
        error: "Unsupported job type",
        allowed: Array.from(ALLOWED_JOB_TYPES),
      });
    }

    const datasetLookup = getDiskDataset(dataset);
    if (!datasetLookup.data) {
      return res.status(400).json({
        error: "Unknown dataset",
        allowed: listDiskDatasetKeys(),
      });
    }

    if (type === "scrapeDisk" && (diskId == null || String(diskId).trim() === "")) {
      return res.status(400).json({ error: "diskId is required for scrapeDisk jobs" });
    }

    if (type === "scrapeGame" && (!gameName || !String(gameName).trim())) {
      return res.status(400).json({ error: "gameName is required for scrapeGame jobs" });
    }

    const job = await enqueueMetadataJob({
      type,
      dataset: datasetLookup.key,
      provider,
      diskId,
      gameName,
      options,
    });

    return res.status(202).json(job);
  } catch (error) {
    console.error("Failed to enqueue metadata job:", error);
    return res.status(500).json({ error: "Failed to enqueue metadata job" });
  }
});

// Convenience endpoint: enqueue async metadata fetch for every game in a dataset
router.post("/scrape-all", async (req, res) => {
  try {
    const {
      dataset = "default",
      provider = process.env.METADATA_DEFAULT_PROVIDER || "hybrid",
      options = {},
    } = req.body || {};

    const datasetLookup = getDiskDataset(dataset);
    if (!datasetLookup.data) {
      return res.status(400).json({
        error: "Unknown dataset",
        allowed: listDiskDatasetKeys(),
      });
    }

    const job = await enqueueMetadataJob({
      type: "scrapeAll",
      dataset: datasetLookup.key,
      provider,
      options,
    });

    return res.status(202).json(job);
  } catch (error) {
    console.error("Failed to enqueue scrape-all metadata job:", error);
    return res.status(500).json({ error: "Failed to enqueue scrape-all metadata job" });
  }
});

router.get("/records", async (req, res) => {
  const { q = "", limit = "100" } = req.query;
  const search = String(q || "").trim().toLowerCase();
  const max = Math.max(1, Math.min(500, Number(limit) || 100));

  const store = await readMetadataStore();
  let records = Object.values(store);

  if (search) {
    records = records.filter((record) => {
      const hay = [
        record?.gameName,
        record?.canonicalTitle,
        record?.normalizedName,
        record?.source?.provider,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(search);
    });
  }

  records.sort((a, b) => {
    const aTime = Date.parse(a?.updatedAt || 0);
    const bTime = Date.parse(b?.updatedAt || 0);
    return bTime - aTime;
  });

  res.json({
    total: records.length,
    records: records.slice(0, max),
  });
});

module.exports = router;
