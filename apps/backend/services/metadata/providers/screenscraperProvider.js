const DEFAULT_BASE_URL = "https://api.screenscraper.fr/api2/jeuRecherche.php";
const DEFAULT_SYSTEM_ID_C64 = "66";

function xmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function redactSecrets(text) {
  let output = String(text || "");
  const secrets = [
    process.env.SCREENSCRAPER_DEV_ID,
    process.env.SCREENSCRAPER_DEV_PASSWORD,
    process.env.SCREENSCRAPER_USER_ID,
    process.env.SCREENSCRAPER_USER_PASSWORD,
  ].filter(Boolean);

  secrets.forEach((secret) => {
    output = output.split(secret).join("[REDACTED]");
  });

  return output;
}

function makeDebugSnippet(raw) {
  return redactSecrets(String(raw || ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

function getCoreCredentials() {
  const userId = process.env.SCREENSCRAPER_USER_ID || "";
  const userPassword = process.env.SCREENSCRAPER_USER_PASSWORD || "";

  const devId = process.env.SCREENSCRAPER_DEV_ID || userId;
  const devPassword = process.env.SCREENSCRAPER_DEV_PASSWORD || userPassword;
  const softname = process.env.SCREENSCRAPER_SOFTNAME || "FloppyStack64";

  return {
    devId,
    devPassword,
    softname,
    userId,
    userPassword,
    usesUserFallbackForDevCreds:
      !process.env.SCREENSCRAPER_DEV_ID &&
      !process.env.SCREENSCRAPER_DEV_PASSWORD &&
      Boolean(userId && userPassword),
  };
}

function ssConfigured() {
  const creds = getCoreCredentials();
  return Boolean(creds.devId && creds.devPassword && creds.softname);
}

function buildSearchUrl(gameRef) {
  const baseUrl = process.env.SCREENSCRAPER_BASE_URL || DEFAULT_BASE_URL;
  const creds = getCoreCredentials();
  const url = new URL(baseUrl);

  url.searchParams.set("devid", creds.devId || "");
  url.searchParams.set("devpassword", creds.devPassword || "");
  url.searchParams.set("softname", creds.softname || "FloppyStack64");
  url.searchParams.set("output", (process.env.SCREENSCRAPER_OUTPUT || "xml").toLowerCase());
  url.searchParams.set("systemeid", process.env.SCREENSCRAPER_SYSTEM_ID_C64 || DEFAULT_SYSTEM_ID_C64);
  url.searchParams.set("recherche", gameRef.gameName);

  if (creds.userId) {
    url.searchParams.set("ssid", creds.userId);
  }
  if (creds.userPassword) {
    url.searchParams.set("sspassword", creds.userPassword);
  }

  return url.toString();
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_err) {
    const trimmed = String(raw || "").trim();
    const lastBrace = trimmed.lastIndexOf("}");
    if (lastBrace > 0) {
      try {
        return JSON.parse(trimmed.slice(0, lastBrace + 1));
      } catch (_err2) {
        return null;
      }
    }
    return null;
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function extractXmlTag(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = String(block || "").match(regex);
  return match ? xmlDecode(match[1].trim()) : null;
}

function extractXmlAttr(openingTag, attrName) {
  const regex = new RegExp(`${attrName}=["']([^"']+)["']`, "i");
  const match = String(openingTag || "").match(regex);
  return match ? xmlDecode(match[1]) : null;
}

function extractXmlBlocks(xml, tagName) {
  const regex = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const blocks = [];
  let match;
  while ((match = regex.exec(String(xml || ""))) !== null) {
    blocks.push({
      attrs: match[1] || "",
      body: match[2] || "",
      full: match[0],
    });
  }
  return blocks;
}

function xmlLooksLikeError(xml) {
  const text = String(xml || "").toLowerCase();
  return (
    text.includes("<html") ||
    text.includes("error") ||
    text.includes("erreur") ||
    text.includes("api closed") ||
    text.includes("banned")
  );
}

function parseXmlCandidates(xml) {
  const jeuBlocks = extractXmlBlocks(xml, "jeu");
  if (!jeuBlocks.length) return [];

  return jeuBlocks.map((block) => {
    const mediaBlocks = extractXmlBlocks(block.body, "media").map((m) => ({
      type: extractXmlAttr(m.attrs, "type") || "",
      region: extractXmlAttr(m.attrs, "region") || "",
      support: extractXmlAttr(m.attrs, "support") || "",
      url: xmlDecode((m.body || "").trim()),
    }));

    return {
      id: extractXmlAttr(block.attrs, "id") || extractXmlTag(block.body, "id"),
      nom: extractXmlTag(block.body, "nom"),
      noms: {
        nom_us: extractXmlTag(block.body, "nom_us"),
        nom_en: extractXmlTag(block.body, "nom_en"),
        nom_uk: extractXmlTag(block.body, "nom_uk"),
        nom_eu: extractXmlTag(block.body, "nom_eu"),
        nom_fr: extractXmlTag(block.body, "nom_fr"),
        noms_commun: extractXmlTag(block.body, "noms_commun"),
      },
      synopsis: {
        synopsis_en: extractXmlTag(block.body, "synopsis_en"),
        synopsis_us: extractXmlTag(block.body, "synopsis_us"),
        synopsis_uk: extractXmlTag(block.body, "synopsis_uk"),
        synopsis_eu: extractXmlTag(block.body, "synopsis_eu"),
        synopsis_fr: extractXmlTag(block.body, "synopsis_fr"),
      },
      developpeur: extractXmlTag(block.body, "developpeur"),
      editeur: extractXmlTag(block.body, "editeur"),
      joueurs:
        extractXmlTag(block.body, "joueurs") ||
        extractXmlTag(block.body, "nbjoueurs") ||
        extractXmlTag(block.body, "players"),
      date: extractXmlTag(block.body, "date") || extractXmlTag(block.body, "dates"),
      genres: {
        nom: extractXmlTag(block.body, "genre"),
      },
      medias: mediaBlocks,
    };
  });
}

function getCandidateGames(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.jeux)) return payload.jeux;
  if (payload.response && Array.isArray(payload.response.jeux)) return payload.response.jeux;
  if (payload.response && payload.response.jeux) return asArray(payload.response.jeux);
  if (payload.jeux) return asArray(payload.jeux);
  return [];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (!s) return t ? t.length : 0;
  if (!t) return s.length;

  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j += 1) prev[j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j += 1) prev[j] = curr[j];
  }

  return prev[t.length];
}

function getNameFields(candidate) {
  const noms = candidate?.noms || {};
  return [
    candidate?.nom,
    candidate?.name,
    candidate?.titre,
    noms?.nom_us,
    noms?.nom_en,
    noms?.nom_uk,
    noms?.nom_fr,
    noms?.nom_eu,
    noms?.noms_commun,
  ].filter(Boolean);
}

function computeMatchConfidence(candidate, query) {
  const nameFields = getNameFields(candidate);
  if (nameFields.length === 0) return 0;

  const scores = nameFields.map((name) => {
    const n = normalizeText(name);
    const q = normalizeText(query);
    if (!n || !q) return 0;
    if (n === q) return 1;
    if (n.startsWith(q) || q.startsWith(n)) return 0.92;
    if (n.includes(q) || q.includes(n)) return 0.8;
    const dist = levenshtein(n, q);
    const maxLen = Math.max(n.length, q.length, 1);
    return Math.max(0, 1 - dist / maxLen);
  });

  return Math.max(...scores);
}

function chooseBestCandidate(candidates, query) {
  let best = null;
  let bestScore = -1;

  candidates.forEach((candidate) => {
    const score = computeMatchConfidence(candidate, query);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return { candidate: best, score: bestScore < 0 ? 0 : bestScore };
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function normalizePlayers(value) {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return (
      firstNonEmpty(value.text, value.nom, value.max, value["1"], value["0"]) ||
      null
    );
  }
  return null;
}

function normalizeYear(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const text = typeof value === "string" ? value : firstNonEmpty(value.text, value.nom, value.date);
  if (!text) return null;
  const match = String(text).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function pickLocalizedTitle(candidate) {
  const noms = candidate?.noms || {};
  return (
    firstNonEmpty(
      candidate?.nom,
      candidate?.titre,
      noms?.nom_us,
      noms?.nom_en,
      noms?.nom_uk,
      noms?.nom_eu,
      noms?.nom_fr,
      noms?.noms_commun
    ) || null
  );
}

function pickLocalizedDescription(candidate) {
  const synopsys = candidate?.synopsis || candidate?.synopsys || {};
  return (
    firstNonEmpty(
      synopsys?.synopsis_en,
      synopsys?.synopsis_us,
      synopsys?.synopsis_uk,
      synopsys?.synopsis_eu,
      synopsys?.synopsis_fr,
      candidate?.description
    ) || null
  );
}

function pickGenre(candidate) {
  const genres = candidate?.genres || candidate?.genre || {};

  if (Array.isArray(genres)) {
    return genres
      .map((g) => firstNonEmpty(g?.noms?.nom_en, g?.noms?.nom_fr, g?.nom))
      .filter(Boolean)
      .join(", ") || null;
  }

  if (Array.isArray(genres.genre)) {
    return genres.genre
      .map((g) => firstNonEmpty(g?.noms?.nom_en, g?.noms?.nom_fr, g?.nom))
      .filter(Boolean)
      .join(", ") || null;
  }

  return firstNonEmpty(
    genres?.noms?.nom_en,
    genres?.noms?.nom_fr,
    genres?.nom,
    candidate?.genre
  );
}

function pickCredits(candidate, key) {
  const credits = candidate?.developpeur || candidate?.developer || candidate?.editeur || candidate?.publisher;
  if (key === "developer") {
    return firstNonEmpty(candidate?.developpeur, candidate?.developer, candidate?.developpers);
  }
  if (key === "publisher") {
    return firstNonEmpty(candidate?.editeur, candidate?.publisher, candidate?.publishers);
  }
  return firstNonEmpty(credits);
}

function flattenMediaCandidates(value, acc = []) {
  if (!value) return acc;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenMediaCandidates(item, acc));
    return acc;
  }
  if (typeof value !== "object") return acc;

  const maybeUrl = firstNonEmpty(value.url, value.href, value.download, value.media, value.media_url);
  if (maybeUrl) {
    acc.push({
      type: String(value.type || value.nomcourt || value.nom || "").toLowerCase(),
      region: String(value.region || value.regionid || value.regionshort || "").toLowerCase(),
      support: String(value.support || value.supportid || "").toLowerCase(),
      url: maybeUrl,
    });
  }

  Object.values(value).forEach((child) => {
    if (child && typeof child === "object") flattenMediaCandidates(child, acc);
  });

  return acc;
}

function scoreMedia(media, patterns) {
  let score = 0;
  const type = media.type || "";
  patterns.forEach((p, idx) => {
    if (type.includes(p)) score += 100 - idx;
  });
  if (media.region.includes("us") || media.region.includes("en") || media.region.includes("wor")) {
    score += 10;
  }
  return score;
}

function pickMediaUrl(candidate, patterns) {
  const medias = candidate?.medias || candidate?.media || {};
  const flattened = flattenMediaCandidates(medias, []);
  if (flattened.length === 0) return null;

  let best = null;
  let bestScore = -1;
  flattened.forEach((m) => {
    const score = scoreMedia(m, patterns);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  });

  return best?.url || null;
}

function normalizeScreenScraperGame(candidate, gameRef, score) {
  return {
    found: true,
    platform: "c64",
    gameName: gameRef.gameName,
    canonicalTitle: pickLocalizedTitle(candidate) || gameRef.gameName,
    description: pickLocalizedDescription(candidate),
    genre: pickGenre(candidate),
    developer: pickCredits(candidate, "developer"),
    publisher: pickCredits(candidate, "publisher"),
    year: normalizeYear(candidate?.dates || candidate?.date || candidate?.releaseDate || candidate?.datedebut),
    players: normalizePlayers(candidate?.joueurs || candidate?.nbjoueurs || candidate?.players),
    images: {
      boxFront: pickMediaUrl(candidate, ["box-2d", "box2d", "box", "cover"]),
      label: pickMediaUrl(candidate, ["wheel-hd", "wheel", "support-2d", "cartridge", "cdrom"]),
      screenshot: pickMediaUrl(candidate, ["ss", "screen", "screenshot", "ingame"]),
      logo: pickMediaUrl(candidate, ["wheel", "marquee", "title"]),
    },
    source: {
      provider: "screenscraper",
      sourceId: firstNonEmpty(candidate?.id, candidate?.idjeu, candidate?.jeu_id),
      matchConfidence: Math.round(score * 100) / 100,
      status: "fetched",
      lastFetchedAt: new Date().toISOString(),
    },
  };
}

async function fetchGameMetadata(gameRef) {
  if (!ssConfigured()) {
    return {
      found: false,
      source: {
        provider: "screenscraper",
        status: "not_configured",
        matchConfidence: null,
      },
    };
  }

  const url = buildSearchUrl(gameRef);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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
      return {
        found: false,
        source: {
          provider: "screenscraper",
          status: `http_${response.status}`,
          matchConfidence: null,
        },
      };
    }

    const raw = await response.text();
    let candidates = [];
    const payload = safeJsonParse(raw);
    if (payload) {
      candidates = getCandidateGames(payload);
    } else if (String(raw || "").trim().startsWith("<")) {
      candidates = parseXmlCandidates(raw);
      if (!candidates.length) {
        return {
          found: false,
          source: {
            provider: "screenscraper",
            status: xmlLooksLikeError(raw) ? "xml_error_response" : "xml_no_matches",
            matchConfidence: null,
            debugSnippet: makeDebugSnippet(raw),
          },
        };
      }
    } else {
      return {
        found: false,
        source: {
          provider: "screenscraper",
          status: "invalid_json",
          matchConfidence: null,
          debugSnippet: makeDebugSnippet(raw),
        },
      };
    }

    if (!candidates.length) {
      return {
        found: false,
        source: {
          provider: "screenscraper",
          status: "not_found",
          matchConfidence: null,
        },
      };
    }

    const { candidate, score } = chooseBestCandidate(candidates, gameRef.gameName);
    if (!candidate) {
      return {
        found: false,
        source: {
          provider: "screenscraper",
          status: "not_found",
          matchConfidence: null,
        },
      };
    }

    return normalizeScreenScraperGame(candidate, gameRef, score);
  } catch (error) {
    return {
      found: false,
      source: {
        provider: "screenscraper",
        status: error.name === "AbortError" ? "timeout" : "error",
        matchConfidence: null,
        debugSnippet: makeDebugSnippet(error?.message || ""),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  name: "screenscraper",
  fetchGameMetadata,
};
