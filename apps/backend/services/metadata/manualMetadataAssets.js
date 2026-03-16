const fs = require("fs");
const path = require("path");

const { normalizeGameName } = require("../../data/metadataStore");
const { ASSET_ROOT } = require("./imageDownloader");

const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function sanitizePathSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function parseDataUrl(dataUrl) {
  const text = String(dataUrl || "");
  const match = text.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;

  const mimeType = String(match[1] || "").toLowerCase();
  const base64 = match[2] || "";
  if (!MIME_EXT[mimeType]) return null;

  try {
    const buffer = Buffer.from(base64, "base64");
    return { mimeType, buffer };
  } catch (_err) {
    return null;
  }
}

async function saveManualImageUpload({
  gameName,
  platform = "c64",
  imageKey = "boxFront",
  dataUrl,
}) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Unsupported or invalid image upload data");
  }

  const gameSlug = sanitizePathSegment(normalizeGameName(gameName));
  const platformSlug = sanitizePathSegment(platform);
  const targetDir = path.join(ASSET_ROOT, "manual", platformSlug, gameSlug);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const ext = MIME_EXT[parsed.mimeType] || ".img";
  const fileName = `${sanitizePathSegment(imageKey)}${ext}`;
  const absolutePath = path.join(targetDir, fileName);
  await fs.promises.writeFile(absolutePath, parsed.buffer);

  const relativePath = path.relative(ASSET_ROOT, absolutePath).split(path.sep).join("/");
  return {
    absolutePath,
    relativePath,
    publicUrl: `/metadata-assets/${relativePath}`,
    bytes: parsed.buffer.length,
    mimeType: parsed.mimeType,
  };
}

module.exports = {
  saveManualImageUpload,
};
