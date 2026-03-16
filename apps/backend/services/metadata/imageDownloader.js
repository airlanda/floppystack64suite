const fs = require("fs");
const path = require("path");

const { normalizeGameName } = require("../../data/metadataStore");

const ASSET_ROOT = path.resolve(__dirname, "..", "..", "data", "metadata-assets");
const IMAGE_KEYS = ["boxFront", "label", "screenshot", "logo"];

function sanitizePathSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function extFromContentType(contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  if (ct.includes("png")) return ".png";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("bmp")) return ".bmp";
  if (ct.includes("svg")) return ".svg";
  return "";
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname || "";
    const ext = path.extname(pathname);
    if (!ext) return "";
    return ext.length <= 5 ? ext.toLowerCase() : "";
  } catch (_err) {
    return "";
  }
}

async function downloadImage({ url, platform, gameName, imageKey }) {
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "FloppyStack64-MetadataWorker/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        imageKey,
        remoteUrl: url,
        status: `http_${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    const bytes = Buffer.from(await response.arrayBuffer());
    const ext = extFromContentType(contentType) || extFromUrl(url) || ".img";

    const gameSlug = sanitizePathSegment(normalizeGameName(gameName));
    const platformSlug = sanitizePathSegment(platform || "c64");
    const targetDir = path.join(ASSET_ROOT, platformSlug, gameSlug);
    await fs.promises.mkdir(targetDir, { recursive: true });

    const fileName = `${sanitizePathSegment(imageKey)}${ext}`;
    const absolutePath = path.join(targetDir, fileName);
    await fs.promises.writeFile(absolutePath, bytes);

    const relativePath = path
      .relative(ASSET_ROOT, absolutePath)
      .split(path.sep)
      .join("/");

    return {
      ok: true,
      imageKey,
      remoteUrl: url,
      bytes: bytes.length,
      contentType: contentType || null,
      absolutePath,
      relativePath,
      publicUrl: `/metadata-assets/${relativePath}`,
    };
  } catch (error) {
    return {
      ok: false,
      imageKey,
      remoteUrl: url,
      status: error.name === "AbortError" ? "timeout" : "error",
      error: error.message || "download failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadMetadataImages(metadata) {
  const images = metadata?.images && typeof metadata.images === "object" ? metadata.images : {};
  const platform = metadata?.platform || "c64";
  const gameName = metadata?.canonicalTitle || metadata?.gameName || "unknown";

  const results = {};
  for (const key of IMAGE_KEYS) {
    if (!images[key]) continue;
    results[key] = await downloadImage({
      url: images[key],
      platform,
      gameName,
      imageKey: key,
    });
  }

  return results;
}

module.exports = {
  ASSET_ROOT,
  downloadImage,
  downloadMetadataImages,
};
