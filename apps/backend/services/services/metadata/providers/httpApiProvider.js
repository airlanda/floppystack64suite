function buildUrl(baseUrl, gameRef) {
  const url = new URL(baseUrl);
  url.searchParams.set("q", gameRef.gameName);
  url.searchParams.set("platform", "c64");
  if (gameRef.dataset) url.searchParams.set("dataset", String(gameRef.dataset));
  if (gameRef.diskId) url.searchParams.set("diskId", String(gameRef.diskId));
  return url.toString();
}

function pickFirstResult(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] || null;
  if (Array.isArray(payload.results)) return payload.results[0] || null;
  if (Array.isArray(payload.items)) return payload.items[0] || null;
  if (payload.game && typeof payload.game === "object") return payload.game;
  if (payload.result && typeof payload.result === "object") return payload.result;
  if (typeof payload === "object") return payload;
  return null;
}

function normalizeApiResult(result, gameRef, providerName) {
  if (!result || typeof result !== "object") {
    return {
      found: false,
      source: { provider: providerName, status: "not_found", matchConfidence: null },
    };
  }

  const canonicalTitle =
    result.canonicalTitle ||
    result.title ||
    result.name ||
    result.gameTitle ||
    gameRef.gameName;

  const images = result.images && typeof result.images === "object" ? result.images : {};

  return {
    found: true,
    platform: "c64",
    gameName: gameRef.gameName,
    canonicalTitle,
    description: result.description ?? result.overview ?? null,
    genre: result.genre ?? result.genres ?? null,
    developer: result.developer ?? result.developers ?? null,
    publisher: result.publisher ?? result.publishers ?? null,
    year: result.year ?? result.releaseYear ?? null,
    players: result.players ?? result.maxPlayers ?? null,
    images: {
      boxFront: images.boxFront ?? result.boxFront ?? result.boxArt ?? null,
      label: images.label ?? result.label ?? result.discLabel ?? null,
      screenshot: images.screenshot ?? result.screenshot ?? null,
      logo: images.logo ?? result.logo ?? result.marquee ?? null,
    },
    source: {
      provider: providerName,
      sourceId: result.id ?? result.sourceId ?? null,
      matchConfidence: result.matchConfidence ?? null,
      status: "fetched",
      lastFetchedAt: new Date().toISOString(),
    },
  };
}

async function fetchGameMetadata(gameRef) {
  const endpoint = process.env.METADATA_API_ENDPOINT;
  const apiKey = process.env.METADATA_API_KEY;
  const apiKeyHeader = process.env.METADATA_API_KEY_HEADER || "x-api-key";
  const providerName = process.env.METADATA_API_PROVIDER_NAME || "api";

  if (!endpoint) {
    return {
      found: false,
      source: { provider: providerName, status: "not_configured", matchConfidence: null },
    };
  }

  const url = buildUrl(endpoint, gameRef);
  const headers = {
    Accept: "application/json",
    "User-Agent": "FloppyStack64-MetadataWorker/1.0",
  };

  if (apiKey) headers[apiKeyHeader] = apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        found: false,
        source: {
          provider: providerName,
          status: `http_${response.status}`,
          matchConfidence: null,
        },
      };
    }

    const payload = await response.json();
    const result = pickFirstResult(payload);
    return normalizeApiResult(result, gameRef, providerName);
  } catch (error) {
    return {
      found: false,
      source: {
        provider: providerName,
        status: error.name === "AbortError" ? "timeout" : "error",
        matchConfidence: null,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  name: "api",
  fetchGameMetadata,
};
