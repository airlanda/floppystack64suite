const screenscraperProvider = require("./screenscraperProvider");
const theGamesDbProvider = require("./theGamesDbProvider");
const apiProvider = require("./httpApiProvider");
const scraperProvider = require("./htmlScraperProvider");
const mockProvider = require("./mockProvider");

async function fetchGameMetadata(gameRef, options = {}) {
  const useMockFallback =
    String(process.env.METADATA_ENABLE_MOCK_FALLBACK || "true").toLowerCase() !== "false";

  const ssResult = await screenscraperProvider.fetchGameMetadata(gameRef, options);
  if (ssResult && ssResult.found) {
    return ssResult;
  }

  const tgdbResult = await theGamesDbProvider.fetchGameMetadata(gameRef, options);
  if (tgdbResult && tgdbResult.found) {
    return tgdbResult;
  }

  const apiResult = await apiProvider.fetchGameMetadata(gameRef, options);
  if (apiResult && apiResult.found) {
    return apiResult;
  }

  const scraperResult = await scraperProvider.fetchGameMetadata(gameRef, options);
  if (scraperResult && scraperResult.found) {
    return scraperResult;
  }

  if (useMockFallback) {
    const mockResult = await mockProvider.fetchGameMetadata(gameRef, options);
    return {
      ...mockResult,
      source: {
        ...(mockResult.source || {}),
        provider: "hybrid(mock-fallback)",
        status: "placeholder",
      },
    };
  }

  return (
    ssResult ||
    tgdbResult ||
    scraperResult ||
    apiResult || {
      found: false,
      source: { provider: "hybrid", status: "not_found", matchConfidence: null },
    }
  );
}

module.exports = {
  name: "hybrid",
  fetchGameMetadata,
};
