const fs = require("fs");
const path = require("path");

const ratingsFilePath = path.join(__dirname, "ratings-overrides.json");

function makeRatingKey({ dataset = "default", diskId, side, gameIndex, gameName }) {
  const normalizedName = String(gameName || "").trim().toLowerCase();
  return [
    String(dataset || "default").toLowerCase(),
    String(diskId ?? ""),
    String(side || ""),
    String(gameIndex ?? ""),
    normalizedName,
  ].join("|");
}

async function ensureRatingsFile() {
  try {
    await fs.promises.access(ratingsFilePath);
  } catch (_err) {
    await fs.promises.writeFile(ratingsFilePath, "{}\n", "utf8");
  }
}

async function readRatingsStore() {
  await ensureRatingsFile();
  const raw = await fs.promises.readFile(ratingsFilePath, "utf8");

  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

async function writeRatingsStore(data) {
  const payload = JSON.stringify(data || {}, null, 2);
  await fs.promises.writeFile(ratingsFilePath, `${payload}\n`, "utf8");
}

async function upsertRating(input) {
  const store = await readRatingsStore();
  const key = makeRatingKey(input);

  store[key] = {
    rating: Number(input.rating),
    updatedAt: new Date().toISOString(),
  };

  await writeRatingsStore(store);
  return { key, value: store[key] };
}

async function removeRating(input) {
  const store = await readRatingsStore();
  const key = makeRatingKey(input);

  delete store[key];
  await writeRatingsStore(store);
  return { key };
}

module.exports = {
  makeRatingKey,
  readRatingsStore,
  upsertRating,
  removeRating,
};
