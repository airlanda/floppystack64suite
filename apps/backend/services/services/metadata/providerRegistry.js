const mockProvider = require("./providers/mockProvider");
const screenscraperProvider = require("./providers/screenscraperProvider");
const theGamesDbProvider = require("./providers/theGamesDbProvider");
const apiProvider = require("./providers/httpApiProvider");
const scraperProvider = require("./providers/htmlScraperProvider");
const hybridProvider = require("./providers/hybridProvider");

const PROVIDERS = {
  mock: mockProvider,
  screenscraper: screenscraperProvider,
  thegamesdb: theGamesDbProvider,
  api: apiProvider,
  scraper: scraperProvider,
  hybrid: hybridProvider,
};

function getMetadataProvider(name) {
  const key = String(name || "mock").toLowerCase();
  return PROVIDERS[key] || PROVIDERS.mock;
}

function listMetadataProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = {
  getMetadataProvider,
  listMetadataProviders,
};
