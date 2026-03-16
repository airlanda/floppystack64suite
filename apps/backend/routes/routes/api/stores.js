const express = require("express");

const router = express.Router();

const {
  addJsonDiskStore,
  appendGamesToDiskStore,
  getEnabledDiskDatasetKeys,
  listDiskStores,
  removeDiskStore,
  setEnabledDiskDatasetKeys,
} = require("../../data/diskDatasets");

router.get("/", (_req, res) => {
  return res.json({
    stores: listDiskStores(),
    activeStoreKeys: getEnabledDiskDatasetKeys(),
  });
});

router.post("/", (req, res) => {
  try {
    const { name, key, jsonData } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Store name is required." });
    }
    if (!jsonData) {
      return res.status(400).json({ error: "jsonData is required." });
    }

    const created = addJsonDiskStore({ name: name.trim(), key, jsonData });
    return res.status(201).json({
      created,
      stores: listDiskStores(),
      activeStoreKeys: getEnabledDiskDatasetKeys(),
    });
  } catch (error) {
    console.error("Failed to add disk store:", error);
    return res.status(400).json({ error: error.message || "Failed to add store" });
  }
});

router.patch("/active", (req, res) => {
  try {
    const keysInput = Array.isArray(req.body?.keys)
      ? req.body.keys
      : req.body?.key
        ? [req.body.key]
        : [];

    const activeStoreKeys = setEnabledDiskDatasetKeys(keysInput);
    return res.json({
      activeStoreKeys,
      stores: listDiskStores(),
    });
  } catch (error) {
    console.error("Failed to update active stores:", error);
    return res.status(400).json({ error: error.message || "Failed to update active stores" });
  }
});

router.post("/games", (req, res) => {
  try {
    const {
      datasetKey,
      diskId,
      side,
      games,
      createStore,
      storeName,
      storeKey,
      activateNewStore,
    } = req.body || {};

    let targetDatasetKey = datasetKey;
    let createdStore = null;

    if (createStore) {
      if (!storeName || !String(storeName).trim()) {
        return res.status(400).json({ error: "storeName is required when createStore is true." });
      }

      createdStore = addJsonDiskStore({
        name: String(storeName).trim(),
        key: storeKey ? String(storeKey).trim() : undefined,
        jsonData: [],
      });
      targetDatasetKey = createdStore.id;

      if (activateNewStore !== false) {
        setEnabledDiskDatasetKeys([targetDatasetKey]);
      }
    }

    if (!targetDatasetKey || !String(targetDatasetKey).trim()) {
      return res.status(400).json({ error: "datasetKey is required unless createStore is true." });
    }

    const result = appendGamesToDiskStore({
      datasetKey: targetDatasetKey,
      diskId,
      side,
      games,
    });

    return res.status(201).json({
      success: true,
      createdStore,
      result,
      stores: listDiskStores(),
      activeStoreKeys: getEnabledDiskDatasetKeys(),
    });
  } catch (error) {
    console.error("Failed to add games to store:", error);
    return res.status(400).json({ error: error.message || "Failed to add games" });
  }
});

router.delete("/:storeKey", (req, res) => {
  try {
    const storeKey = String(req.params.storeKey || "").trim();
    if (!storeKey) {
      return res.status(400).json({ error: "storeKey is required." });
    }

    const result = removeDiskStore(storeKey);

    return res.json({
      success: true,
      ...result,
      stores: listDiskStores(),
      activeStoreKeys: getEnabledDiskDatasetKeys(),
    });
  } catch (error) {
    console.error("Failed to delete store:", error);
    return res.status(400).json({ error: error.message || "Failed to delete store" });
  }
});

module.exports = router;
