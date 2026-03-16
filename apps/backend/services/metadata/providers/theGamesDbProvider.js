const DEFAULT_BASE_URL = "https://api.thegamesdb.net/v1.1";
const DEFAULT_C64_PLATFORM_IDS = ["40"];
const DEFAULT_LOOKUP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const lookupCache = {
  expiresAt: 0,
  maps: null,
  inFlight: null,
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toYear(value) {
  const text = String(value || "").trim();
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

function getPreferredC64PlatformIds() {
  const legacySingle = process.env.THEGAMESDB_PLATFORM_ID_C64;
  const csv = process.env.THEGAMESDB_PLATFORM_IDS_C64;

  const configured = uniqueStrings([
    ...(csv ? String(csv).split(",") : []),
    ...(legacySingle ? [legacySingle] : []),
  ]);

  // Always include the canonical C64 ID unless explicitly disabled in code.
  return uniqueStrings([...configured, ...DEFAULT_C64_PLATFORM_IDS]);
}

function buildSearchUrl(gameRef) {
  const baseUrl = process.env.THEGAMESDB_BASE_URL || DEFAULT_BASE_URL;
  const publicKey = process.env.THEGAMESDB_PUBLIC_KEY || "";
  const normalizedBaseUrl = String(baseUrl).endsWith("/") ? String(baseUrl) : `${baseUrl}/`;
  const url = new URL("Games/ByGameName", normalizedBaseUrl);

  url.searchParams.set("apikey", publicKey);
  url.searchParams.set("name", gameRef.gameName);
  url.searchParams.set("fields", "players,genres,overview,developers,publishers");
  url.searchParams.set("include", "boxart,genres,developers,publishers");
  // Do local platform filtering because TheGamesDB may have multiple relevant platform IDs
  // and the API filter syntax can vary by endpoint/version.

  return url.toString();
}

function buildLookupUrl(resource) {
  const configuredLookupBase = process.env.THEGAMESDB_LOOKUP_BASE_URL;
  const baseUrl = configuredLookupBase || process.env.THEGAMESDB_BASE_URL || DEFAULT_BASE_URL;
  const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, "");
  const v1Base = normalizedBaseUrl.replace(/\/v1(?:\.1)?$/i, "/v1");
  return `${v1Base}/${resource}`;
}

function readLookupCacheTtlMs() {
  const configured = Number(process.env.THEGAMESDB_LOOKUP_CACHE_TTL_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_LOOKUP_CACHE_TTL_MS;
  return configured;
}

function platformMatches(game, expectedPlatformIds) {
  const expectedIds = uniqueStrings(asArray(expectedPlatformIds));
  if (!expectedIds.length) return true;
  const candidates = new Set();

  asArray(game?.platforms).forEach((value) => candidates.add(String(value)));
  asArray(game?.platform).forEach((value) => candidates.add(String(value)));
  if (game?.platform && typeof game.platform === "object") {
    if (game.platform.id != null) candidates.add(String(game.platform.id));
    if (game.platform.platform != null) candidates.add(String(game.platform.platform));
  }

  return expectedIds.some((id) => candidates.has(id));
}

function computeMatchConfidence(gameRef, game) {
  const wanted = normalizeTitle(gameRef.gameName);
  const actual = normalizeTitle(
    firstNonEmptyString(game?.game_title, game?.gameTitle, game?.name, game?.title, gameRef.gameName)
  );

  if (!wanted || !actual) return null;
  if (wanted === actual) return 0.95;
  if (actual.includes(wanted) || wanted.includes(actual)) return 0.8;

  const wantedTokens = new Set(wanted.split(/\s+/).filter(Boolean));
  const actualTokens = new Set(actual.split(/\s+/).filter(Boolean));
  if (!wantedTokens.size || !actualTokens.size) return 0.5;

  let overlap = 0;
  wantedTokens.forEach((token) => {
    if (actualTokens.has(token)) overlap += 1;
  });

  const ratio = overlap / Math.max(wantedTokens.size, actualTokens.size);
  return Math.max(0.3, Math.min(0.75, Number(ratio.toFixed(2))));
}

function getIncludeDataMap(payload, keys) {
  for (const key of keys) {
    const map = payload?.include?.[key]?.data;
    if (map && typeof map === "object") return map;
    const dataMap = payload?.data?.[key];
    if (dataMap && typeof dataMap === "object") return dataMap;
  }
  return null;
}

function normalizeLookupMap(payload, keys) {
  for (const key of keys) {
    const map = payload?.data?.[key];
    if (map && typeof map === "object" && !Array.isArray(map)) return map;

    const list = payload?.data?.[key];
    if (Array.isArray(list)) {
      return list.reduce((acc, entry) => {
        if (!entry || typeof entry !== "object") return acc;
        const id = entry.id != null ? String(entry.id) : null;
        if (!id) return acc;
        acc[id] = entry;
        return acc;
      }, {});
    }
  }

  return null;
}

function mergeMaps(primaryMap, fallbackMap) {
  if (primaryMap && fallbackMap) return { ...fallbackMap, ...primaryMap };
  return primaryMap || fallbackMap || null;
}

function mapIdsToNames(ids, includeMap) {
  if (!includeMap) return null;

  const normalizedMap = Array.isArray(includeMap)
    ? includeMap.reduce((acc, entry) => {
        if (!entry || typeof entry !== "object") return acc;
        const id = entry.id != null ? String(entry.id) : null;
        if (id) acc[id] = entry;
        return acc;
      }, {})
    : includeMap;

  const names = asArray(ids)
    .map((id) => normalizedMap[String(id)] || normalizedMap[id])
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (!entry || typeof entry !== "object") return null;
      return firstNonEmptyString(entry.name, entry.title, entry.developer, entry.publisher, entry.genre);
    })
    .filter(Boolean);

  return names.length ? names.join(", ") : null;
}

function toNameList(value, includeMap) {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    const looksLikeIds = parts.length > 0 && parts.every((part) => /^\d+$/.test(part));
    if (looksLikeIds) {
      return mapIdsToNames(parts, includeMap) || trimmed;
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    if (!value.length) return null;

    if (typeof value[0] === "object" && value[0] !== null) {
      const names = value
        .map((entry) =>
          firstNonEmptyString(entry.name, entry.title, entry.developer, entry.publisher, entry.genre)
        )
        .filter(Boolean);
      return names.length ? names.join(", ") : null;
    }

    return mapIdsToNames(value, includeMap) || value.join(", ");
  }

  if (typeof value === "number") {
    return mapIdsToNames([value], includeMap) || String(value);
  }

  if (typeof value === "object") {
    return firstNonEmptyString(value.name, value.title, value.developer, value.publisher, value.genre);
  }

  return null;
}

async function fetchLookupMap(resource, keys, publicKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const url = new URL(buildLookupUrl(resource));
    url.searchParams.set("apikey", publicKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "FloppyStack64-MetadataWorker/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = await response.json();
    return normalizeLookupMap(payload, keys);
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getLookupMaps(publicKey) {
  const now = Date.now();
  if (lookupCache.maps && now < lookupCache.expiresAt) {
    return lookupCache.maps;
  }

  if (lookupCache.inFlight) {
    return lookupCache.inFlight;
  }

  lookupCache.inFlight = (async () => {
    const [developers, publishers, genres] = await Promise.all([
      fetchLookupMap("Developers", ["developers", "developer"], publicKey),
      fetchLookupMap("Publishers", ["publishers", "publisher"], publicKey),
      fetchLookupMap("Genres", ["genres", "genre"], publicKey),
    ]);

    const maps = {
      developers: developers || null,
      publishers: publishers || null,
      genres: genres || null,
    };

    lookupCache.maps = maps;
    lookupCache.expiresAt = Date.now() + readLookupCacheTtlMs();
    return maps;
  })();

  try {
    return await lookupCache.inFlight;
  } finally {
    lookupCache.inFlight = null;
  }
}

function pickGames(payload) {
  const list =
    payload?.data?.games ||
    payload?.data?.Game ||
    payload?.games ||
    payload?.data ||
    [];
  return Array.isArray(list) ? list : [];
}

function chooseBestGame(payload, gameRef) {
  const preferredPlatformIds = getPreferredC64PlatformIds();
  const games = pickGames(payload);

  const exactTitleMatches = games.filter((game) => {
    const title = normalizeTitle(
      firstNonEmptyString(game?.game_title, game?.gameTitle, game?.name, game?.title)
    );
    return title && title === normalizeTitle(gameRef.gameName);
  });

  const platformFiltered = games.filter((game) => platformMatches(game, preferredPlatformIds));
  const exactAndPlatform = exactTitleMatches.filter((game) =>
    platformMatches(game, preferredPlatformIds)
  );

  let pool = exactAndPlatform;
  if (!pool.length) pool = platformFiltered;
  if (!pool.length) pool = exactTitleMatches;
  if (!pool.length) pool = games;
  if (!pool.length) return null;

  // Prefer platform matches, then earliest release year (usually original) among exact titles.
  const scored = pool
    .map((game) => {
      const releaseYear = Number(toYear(game?.release_date || game?.releaseDate) || 9999);
      return {
        game,
        platformScore: platformMatches(game, preferredPlatformIds) ? 0 : 1,
        exactScore:
          normalizeTitle(firstNonEmptyString(game?.game_title, game?.gameTitle, game?.name, game?.title)) ===
          normalizeTitle(gameRef.gameName)
            ? 0
            : 1,
        releaseYearScore: Number.isFinite(releaseYear) ? releaseYear : 9999,
        regionPenalty: Number(game?.region_id || 0) === 0 ? 0 : 1,
      };
    })
    .sort((a, b) => {
      if (a.exactScore !== b.exactScore) return a.exactScore - b.exactScore;
      if (a.platformScore !== b.platformScore) return a.platformScore - b.platformScore;
      if (a.releaseYearScore !== b.releaseYearScore) return a.releaseYearScore - b.releaseYearScore;
      if (a.regionPenalty !== b.regionPenalty) return a.regionPenalty - b.regionPenalty;
      return Number(a.game?.id || 0) - Number(b.game?.id || 0);
    });

  return scored[0]?.game || pool[0];
}

function resolveArtBaseUrl(boxartInclude) {
  const base = boxartInclude?.base_url;
  if (typeof base === "string") return base;
  if (!base || typeof base !== "object") return null;

  return firstNonEmptyString(
    base.original,
    base.large,
    base.medium,
    base.small,
    base.thumb,
    base.cropped_center_thumb
  );
}

function joinUrl(base, path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path;

  const cleanBase = String(base).replace(/\/+$/, "");
  const cleanPath = String(path).replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

function pickArt(artEntries, matcher) {
  return artEntries.find((entry) => matcher(String(entry?.type || "").toLowerCase(), String(entry?.side || "").toLowerCase()));
}

function extractImages(payload, game) {
  const boxartInclude = payload?.include?.boxart || payload?.include?.boxArt || null;
  const boxartData = boxartInclude?.data;
  const gameId = game?.id != null ? String(game.id) : null;
  const artEntries = gameId && boxartData ? asArray(boxartData[gameId]) : [];
  const baseUrl = resolveArtBaseUrl(boxartInclude);

  const frontBox =
    pickArt(artEntries, (type, side) => type.includes("boxart") && side === "front") ||
    pickArt(artEntries, (type) => type.includes("boxart")) ||
    null;
  const screenshot =
    pickArt(artEntries, (type) => type.includes("screenshot")) ||
    pickArt(artEntries, (type) => type.includes("fanart")) ||
    null;
  const logo =
    pickArt(artEntries, (type) => type.includes("clearlogo") || type === "logo") || null;
  const label =
    pickArt(artEntries, (type) => type.includes("label") || type.includes("cartart")) || null;

  return {
    boxFront: joinUrl(baseUrl, frontBox?.filename),
    label: joinUrl(baseUrl, label?.filename),
    screenshot: joinUrl(baseUrl, screenshot?.filename),
    logo: joinUrl(baseUrl, logo?.filename),
  };
}

function normalizeGame(payload, gameRef, game, lookupMaps = null) {
  if (!game || typeof game !== "object") {
    return {
      found: false,
      source: { provider: "thegamesdb", status: "not_found", matchConfidence: null },
    };
  }

  const genresMap = mergeMaps(
    getIncludeDataMap(payload, ["genres", "genre"]),
    lookupMaps?.genres || null
  );
  const developersMap = mergeMaps(
    getIncludeDataMap(payload, ["developers", "developer"]),
    lookupMaps?.developers || null
  );
  const publishersMap = mergeMaps(
    getIncludeDataMap(payload, ["publishers", "publisher"]),
    lookupMaps?.publishers || null
  );
  const canonicalTitle =
    firstNonEmptyString(game.game_title, game.gameTitle, game.name, game.title) || gameRef.gameName;

  return {
    found: true,
    platform: "c64",
    gameName: gameRef.gameName,
    canonicalTitle,
    description: firstNonEmptyString(game.overview, game.description),
    genre: toNameList(game.genres, genresMap),
    developer: toNameList(game.developers, developersMap),
    publisher: toNameList(game.publishers, publishersMap),
    year: firstNonEmptyString(game.year) || toYear(game.release_date || game.releaseDate),
    players: game.players != null ? String(game.players) : null,
    images: extractImages(payload, game),
    source: {
      provider: "thegamesdb",
      sourceId: game.id != null ? String(game.id) : null,
      matchConfidence: computeMatchConfidence(gameRef, game),
      status: "fetched",
      lastFetchedAt: new Date().toISOString(),
    },
  };
}

async function fetchGameMetadata(gameRef) {
  const publicKey = process.env.THEGAMESDB_PUBLIC_KEY;

  if (!publicKey) {
    return {
      found: false,
      source: { provider: "thegamesdb", status: "not_configured", matchConfidence: null },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(buildSearchUrl(gameRef), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "FloppyStack64-MetadataWorker/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        found: false,
        source: {
          provider: "thegamesdb",
          status: `http_${response.status}`,
          matchConfidence: null,
        },
      };
    }

    const payload = await response.json();
    const game = chooseBestGame(payload, gameRef);
    const lookupMaps = await getLookupMaps(publicKey);
    return normalizeGame(payload, gameRef, game, lookupMaps);
  } catch (error) {
    return {
      found: false,
      source: {
        provider: "thegamesdb",
        status: error.name === "AbortError" ? "timeout" : "error",
        matchConfidence: null,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  name: "thegamesdb",
  fetchGameMetadata,
};
