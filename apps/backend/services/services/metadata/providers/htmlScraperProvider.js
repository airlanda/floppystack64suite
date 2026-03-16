function templateValue(str, gameRef) {
  return String(str || "")
    .replaceAll("{query}", encodeURIComponent(gameRef.gameName))
    .replaceAll("{gameName}", encodeURIComponent(gameRef.gameName))
    .replaceAll("{diskId}", encodeURIComponent(String(gameRef.diskId || "")))
    .replaceAll("{dataset}", encodeURIComponent(String(gameRef.dataset || "default")));
}

function extractMetaContent(html, propertyName) {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propertyName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(regex);
  return match ? match[1] : null;
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchGameMetadata(gameRef) {
  const providerName = process.env.METADATA_SCRAPER_PROVIDER_NAME || "scraper";
  const pageTemplate = process.env.METADATA_SCRAPER_URL_TEMPLATE;

  if (!pageTemplate) {
    return {
      found: false,
      source: { provider: providerName, status: "not_configured", matchConfidence: null },
    };
  }

  const url = templateValue(pageTemplate, gameRef);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "FloppyStack64-MetadataWorker/1.0",
      },
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

    const html = await response.text();
    const ogTitle = extractMetaContent(html, "og:title");
    const ogDescription = extractMetaContent(html, "og:description");
    const ogImage = extractMetaContent(html, "og:image");
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? stripTags(titleMatch[1]) : null;

    const canonicalTitle = ogTitle || pageTitle || gameRef.gameName;

    return {
      found: Boolean(canonicalTitle),
      platform: "c64",
      gameName: gameRef.gameName,
      canonicalTitle,
      description: ogDescription || null,
      genre: null,
      developer: null,
      publisher: null,
      year: null,
      players: null,
      images: {
        boxFront: ogImage || null,
        label: null,
        screenshot: null,
        logo: null,
      },
      source: {
        provider: providerName,
        sourceId: url,
        matchConfidence: ogTitle ? 0.45 : 0.2,
        status: "scraped",
        lastFetchedAt: new Date().toISOString(),
      },
    };
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
  name: "scraper",
  fetchGameMetadata,
};
