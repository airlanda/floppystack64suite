export function isValidApiBaseUrl(value) {
  const text = String(value || "").trim();
  if (!text) return true; // empty means use default
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(text);
}

export function parseGamesLines(gamesText) {
  return String(gamesText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateDiskSideTitlesText(text) {
  const titles = parseGamesLines(text);
  if (!titles.length) {
    return { valid: false, error: "Add at least one title." };
  }
  return { valid: true, error: "", titles };
}

export function validateAddGamesForm(form = {}) {
  const errors = {};
  const mode = form.mode === "new" ? "new" : "existing";
  const diskId = String(form.diskId || "").trim();
  const side = form.side === "sideB" ? "sideB" : form.side === "sideA" ? "sideA" : "";
  const games = parseGamesLines(form.gamesText);

  if (mode === "existing" && !String(form.datasetKey || "").trim()) {
    errors.datasetKey = "Choose a target store.";
  }
  if (mode === "new" && !String(form.newStoreName || "").trim()) {
    errors.newStoreName = "Store name is required.";
  }
  if (!diskId) {
    errors.diskId = "Disk ID is required.";
  }
  if (!side) {
    errors.side = "Choose Side A or Side B.";
  }
  if (!games.length) {
    errors.gamesText = "Add at least one game title.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: { mode, diskId, side, games },
  };
}

