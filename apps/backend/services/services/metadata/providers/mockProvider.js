function fakeDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function fetchGameMetadata(gameRef, _options = {}) {
  // Simulated provider delay so async jobs/progress are visible while building the pipeline.
  await fakeDelay(40);

  const canonicalTitle = titleCase(gameRef.gameName);

  return {
    found: true,
    platform: "c64",
    gameName: gameRef.gameName,
    canonicalTitle,
    description: null,
    genre: null,
    developer: null,
    publisher: null,
    year: null,
    players: null,
    images: {
      boxFront: null,
      label: null,
      screenshot: null,
      logo: null,
    },
    source: {
      provider: "mock",
      sourceId: null,
      matchConfidence: 0.25,
      status: "placeholder",
      lastFetchedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  name: "mock",
  fetchGameMetadata,
};
