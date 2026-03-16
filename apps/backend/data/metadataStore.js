const fs = require("fs");
const path = require("path");

const metadataFilePath = path.join(__dirname, "metadata-records.json");

function normalizeGameName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

function makeMetadataKey({ platform = "c64", gameName }) {
  const normalizedName = normalizeGameName(gameName);
  return `${String(platform).toLowerCase()}|${normalizedName}`;
}

async function ensureFile() {
  try {
    await fs.promises.access(metadataFilePath);
  } catch (_err) {
    await fs.promises.writeFile(metadataFilePath, "{}\n", "utf8");
  }
}

async function readMetadataStore() {
  await ensureFile();
  const raw = await fs.promises.readFile(metadataFilePath, "utf8");
  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

async function writeMetadataStore(data) {
  await fs.promises.writeFile(metadataFilePath, `${JSON.stringify(data || {}, null, 2)}\n`, "utf8");
}

async function upsertMetadataRecord(recordInput) {
  const store = await readMetadataStore();
  const now = new Date().toISOString();

  const key =
    recordInput.key ||
    makeMetadataKey({ platform: recordInput.platform || "c64", gameName: recordInput.gameName });

  const previous = store[key] && typeof store[key] === "object" ? store[key] : {};
  const next = {
    key,
    platform: recordInput.platform || previous.platform || "c64",
    gameName: recordInput.gameName || previous.gameName || "",
    normalizedName:
      recordInput.normalizedName ||
      previous.normalizedName ||
      normalizeGameName(recordInput.gameName || previous.gameName),
    canonicalTitle:
      recordInput.canonicalTitle != null
        ? recordInput.canonicalTitle
        : previous.canonicalTitle || null,
    description:
      recordInput.description != null ? recordInput.description : previous.description || null,
    genre: recordInput.genre != null ? recordInput.genre : previous.genre || null,
    developer: recordInput.developer != null ? recordInput.developer : previous.developer || null,
    publisher: recordInput.publisher != null ? recordInput.publisher : previous.publisher || null,
    year: recordInput.year != null ? recordInput.year : previous.year || null,
    players: recordInput.players != null ? recordInput.players : previous.players || null,
    images: {
      boxFront:
        recordInput.images && Object.prototype.hasOwnProperty.call(recordInput.images, "boxFront")
          ? recordInput.images.boxFront
          : previous.images?.boxFront || null,
      label:
        recordInput.images && Object.prototype.hasOwnProperty.call(recordInput.images, "label")
          ? recordInput.images.label
          : previous.images?.label || null,
      screenshot:
        recordInput.images && Object.prototype.hasOwnProperty.call(recordInput.images, "screenshot")
          ? recordInput.images.screenshot
          : previous.images?.screenshot || null,
      logo:
        recordInput.images && Object.prototype.hasOwnProperty.call(recordInput.images, "logo")
          ? recordInput.images.logo
          : previous.images?.logo || null,
    },
    source: {
      provider: recordInput.source?.provider || previous.source?.provider || "mock",
      sourceId:
        recordInput.source && Object.prototype.hasOwnProperty.call(recordInput.source, "sourceId")
          ? recordInput.source.sourceId
          : previous.source?.sourceId || null,
      matchConfidence:
        recordInput.source &&
        Object.prototype.hasOwnProperty.call(recordInput.source, "matchConfidence")
          ? recordInput.source.matchConfidence
          : previous.source?.matchConfidence || null,
      status: recordInput.source?.status || previous.source?.status || "fetched",
      lastFetchedAt: recordInput.source?.lastFetchedAt || now,
      debugSnippet:
        recordInput.source &&
        Object.prototype.hasOwnProperty.call(recordInput.source, "debugSnippet")
          ? recordInput.source.debugSnippet
          : previous.source?.debugSnippet || null,
    },
    updatedAt: now,
    createdAt: previous.createdAt || now,
  };

  store[key] = next;
  await writeMetadataStore(store);
  return next;
}

module.exports = {
  makeMetadataKey,
  normalizeGameName,
  readMetadataStore,
  writeMetadataStore,
  upsertMetadataRecord,
};
