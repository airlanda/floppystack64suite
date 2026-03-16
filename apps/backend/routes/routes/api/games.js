const express = require("express");

const router = express.Router();

const {
  getDiskDataset,
  getMergedEnabledDiskDataset,
  listDiskDatasetKeys,
} = require("../../data/diskDatasets");
const { readMetadataStore, makeMetadataKey, normalizeGameName } = require("../../data/metadataStore");

function simpleContains(haystack, needle) {
  if (!needle) return true;
  return String(haystack || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

function isPlaceholderRecord(record) {
  const status = String(record?.source?.status || "").toLowerCase();
  return status === "placeholder" || status === "manual";
}

router.get("/search", async (req, res) => {
  try {
    const useMerged = !req.query.dataset;
    const datasetInput = req.query.dataset || "default";
    const datasetLookup = useMerged
      ? getMergedEnabledDiskDataset()
      : getDiskDataset(datasetInput);
    const datasetKey = useMerged ? "default" : datasetLookup.key;
    const data = datasetLookup.data;
    if (!data) {
      return res.status(400).json({
        error: "Unknown dataset",
        allowed: listDiskDatasetKeys(),
      });
    }

    const q = String(req.query.q || "").trim();
    const normalizedQ = normalizeGameName(q);
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 500));

    const metadataStore = await readMetadataStore();
    const byGame = new Map();

    data.forEach((disk) => {
      if (!disk || typeof disk !== "object") return;

      ["sideA", "sideB"].forEach((sideKey) => {
        const games = Array.isArray(disk[sideKey]) ? disk[sideKey] : [];
        games.forEach((game, gameIndex) => {
          const gameName = game && typeof game === "object" ? game.gameName : game;
          if (!gameName) return;

          const normalizedName = normalizeGameName(gameName);
          const key = makeMetadataKey({ platform: "c64", gameName });
          const metadata = metadataStore[key] || null;

          const existing = byGame.get(normalizedName);
          const location = {
            diskId: String(disk._id),
            side: sideKey,
            sideLabel: sideKey === "sideA" ? "A" : "B",
            slot: gameIndex + 1,
            datasetKey: disk.datasetKey || datasetKey,
            datasetName: disk.datasetName || null,
            rating:
              game && typeof game === "object" && game.rating != null ? Number(game.rating) : null,
          };

          if (!existing) {
            byGame.set(normalizedName, {
              key: normalizedName,
              gameName: String(gameName),
              normalizedName,
              metadataKey: key,
              metadata,
              locations: [location],
            });
            return;
          }

          const hasLocation = existing.locations.some(
            (loc) =>
              loc.diskId === location.diskId && loc.side === location.side && loc.slot === location.slot
          );
          if (!hasLocation) existing.locations.push(location);

          // Prefer non-placeholder records and records with images/description.
          if (!existing.metadata && metadata) {
            existing.metadata = metadata;
          } else if (existing.metadata && metadata) {
            const existingScore =
              Number(Boolean(existing.metadata.images?.boxFront)) +
              Number(Boolean(existing.metadata.description)) +
              Number(!isPlaceholderRecord(existing.metadata));
            const nextScore =
              Number(Boolean(metadata.images?.boxFront)) +
              Number(Boolean(metadata.description)) +
              Number(!isPlaceholderRecord(metadata));
            if (nextScore > existingScore) {
              existing.metadata = metadata;
            }
          }
        });
      });
    });

    let results = Array.from(byGame.values());
    if (normalizedQ) {
      results = results.filter((entry) => {
        return (
          simpleContains(entry.gameName, q) ||
          simpleContains(entry.metadata?.canonicalTitle, q) ||
          simpleContains(entry.normalizedName, normalizedQ)
        );
      });
    }

    results.sort((a, b) => {
      const aName = (a.metadata?.canonicalTitle || a.gameName || "").toLowerCase();
      const bName = (b.metadata?.canonicalTitle || b.gameName || "").toLowerCase();
      return aName.localeCompare(bName);
    });

    const trimmed = results.slice(0, limit).map((entry) => {
      const metadata = entry.metadata || null;
      return {
        key: entry.key,
        gameName: entry.gameName,
        normalizedName: entry.normalizedName,
        locations: entry.locations.sort((a, b) => {
          const diskDiff = Number(a.diskId) - Number(b.diskId);
          if (!Number.isNaN(diskDiff) && diskDiff !== 0) return diskDiff;
          if (a.diskId !== b.diskId) return String(a.diskId).localeCompare(String(b.diskId));
          if (a.side !== b.side) return a.side.localeCompare(b.side);
          return a.slot - b.slot;
        }),
        metadata: metadata
          ? {
              canonicalTitle: metadata.canonicalTitle || entry.gameName,
              description: metadata.description || null,
              genre: metadata.genre || null,
              developer: metadata.developer || null,
              publisher: metadata.publisher || null,
              year: metadata.year || null,
              players: metadata.players || null,
              images: metadata.images || {},
              source: metadata.source || null,
              updatedAt: metadata.updatedAt || null,
            }
          : null,
      };
    });

    return res.json({
      dataset: datasetKey,
      q,
      total: results.length,
      returned: trimmed.length,
      results: trimmed,
    });
  } catch (error) {
    console.error("Game search endpoint failed:", error);
    return res.status(500).json({ error: "Failed to search games" });
  }
});

module.exports = router;
