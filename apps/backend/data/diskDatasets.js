const fs = require("fs");
const path = require("path");

const gameDiskOrigDB = require("./gameDiskOrigDB");
const gameDiskCollection1Db = require("./gameDiskCollection1Db");

const CUSTOM_STORE_DIR = path.join(__dirname, "custom-disk-stores");
const STORE_CONFIG_PATH = path.join(__dirname, "disk-stores.json");

const BUILTIN_STORES = {
  orig: {
    id: "orig",
    name: "Original Collection",
    type: "builtin",
    data: gameDiskOrigDB,
    source: "data/gameDiskOrigDB.js",
  },
  collection1: {
    id: "collection1",
    name: "Collection 1",
    type: "builtin",
    data: gameDiskCollection1Db,
    source: "data/gameDiskCollection1Db.js",
  },
};

const DATASET_ALIASES = {
  default: "orig",
};

function normalizeDatasetKey(input) {
  return String(input || "default").trim().toLowerCase();
}

function resolveDatasetKey(input) {
  const normalized = normalizeDatasetKey(input);
  return DATASET_ALIASES[normalized] || normalized;
}

function slugifyKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureStoreConfig() {
  if (!fs.existsSync(CUSTOM_STORE_DIR)) {
    fs.mkdirSync(CUSTOM_STORE_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_CONFIG_PATH)) {
    const initial = {
      activeStoreKeys: ["orig"],
      stores: [],
    };
    fs.writeFileSync(STORE_CONFIG_PATH, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
  }
}

function readStoreConfig() {
  ensureStoreConfig();
  try {
    const raw = fs.readFileSync(STORE_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { activeStoreKeys: ["orig"], stores: [] };
    }
    return {
      activeStoreKeys: Array.isArray(parsed.activeStoreKeys) ? parsed.activeStoreKeys : ["orig"],
      stores: Array.isArray(parsed.stores) ? parsed.stores : [],
    };
  } catch (_err) {
    return { activeStoreKeys: ["orig"], stores: [] };
  }
}

function writeStoreConfig(config) {
  ensureStoreConfig();
  const next = {
    activeStoreKeys: Array.isArray(config?.activeStoreKeys) ? config.activeStoreKeys : ["orig"],
    stores: Array.isArray(config?.stores) ? config.stores : [],
  };
  fs.writeFileSync(STORE_CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function normalizeGameList(listInput) {
  const list = Array.isArray(listInput) ? listInput : [];
  return list
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const gameName = String(entry.gameName || "").trim();
        if (!gameName) return null;
        const next = { gameName };
        if (entry.rating != null && !Number.isNaN(Number(entry.rating))) {
          next.rating = Number(entry.rating);
        }
        return next;
      }
      const gameName = String(entry || "").trim();
      if (!gameName) return null;
      return { gameName };
    })
    .filter(Boolean);
}

function normalizeDiskDataset(dataInput) {
  const rawData = Array.isArray(dataInput)
    ? dataInput
    : dataInput && Array.isArray(dataInput.disks)
      ? dataInput.disks
      : null;

  if (!rawData) {
    throw new Error("Disk store JSON must be an array or an object with a 'disks' array.");
  }

  return rawData
    .filter((disk) => disk && typeof disk === "object")
    .map((disk, index) => ({
      _id: String(disk._id != null ? disk._id : index + 1),
      sideA: normalizeGameList(disk.sideA),
      sideB: normalizeGameList(disk.sideB),
    }));
}

function readCustomStoreData(relativePath) {
  const normalizedRelative = String(relativePath || "").replace(/\\/g, "/");
  if (!normalizedRelative) return null;

  const fullPath = path.resolve(__dirname, normalizedRelative);
  if (!fullPath.startsWith(path.resolve(__dirname))) {
    return null;
  }

  if (!fs.existsSync(fullPath)) return null;

  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeDiskDataset(parsed);
  } catch (_err) {
    return null;
  }
}

function getStoreDefinitionMap() {
  const config = readStoreConfig();
  const map = new Map();

  Object.values(BUILTIN_STORES).forEach((store) => {
    map.set(store.id, { ...store });
  });

  config.stores.forEach((store) => {
    if (!store || typeof store !== "object") return;
    const id = slugifyKey(store.id || store.key || store.name || "");
    if (!id) return;
    if (map.has(id)) return;
    map.set(id, {
      id,
      name: String(store.name || id),
      type: "json-file",
      source: String(store.file || ""),
      createdAt: store.createdAt || null,
    });
  });

  return map;
}

function listDiskStores() {
  const config = readStoreConfig();
  const activeSet = new Set(
    (Array.isArray(config.activeStoreKeys) ? config.activeStoreKeys : ["orig"])
      .map((key) => resolveDatasetKey(key))
  );
  const storeMap = getStoreDefinitionMap();

  return Array.from(storeMap.values()).map((store) => {
    const lookup = getDiskDataset(store.id);
    return {
      id: store.id,
      name: store.name,
      type: store.type,
      source: store.source,
      active: activeSet.has(store.id),
      available: Array.isArray(lookup.data),
      diskCount: Array.isArray(lookup.data) ? lookup.data.length : 0,
      createdAt: store.createdAt || null,
    };
  });
}

function listDiskDatasetKeys() {
  const storeMap = getStoreDefinitionMap();
  return ["default", ...Array.from(storeMap.keys())];
}

function getDiskDataset(inputKey) {
  const key = resolveDatasetKey(inputKey);
  const storeMap = getStoreDefinitionMap();
  const store = storeMap.get(key);

  if (!store) {
    return {
      key,
      data: null,
      store: null,
    };
  }

  const data =
    store.type === "builtin"
      ? normalizeDiskDataset(store.data)
      : readCustomStoreData(store.source);

  return {
    key,
    data,
    store: {
      id: store.id,
      name: store.name,
      type: store.type,
      source: store.source,
    },
  };
}

function getEnabledDiskDatasetKeys() {
  const config = readStoreConfig();
  const storeMap = getStoreDefinitionMap();
  const valid = (Array.isArray(config.activeStoreKeys) ? config.activeStoreKeys : ["orig"])
    .map((key) => resolveDatasetKey(key))
    .filter((key) => storeMap.has(key));

  if (!valid.length) return ["orig"];
  return [valid[0]];
}

function setEnabledDiskDatasetKeys(keysInput) {
  const storeMap = getStoreDefinitionMap();
  const nextKeys = (Array.isArray(keysInput) ? keysInput : [])
    .map((key) => resolveDatasetKey(key))
    .filter((key) => storeMap.has(key));
  const safeKeys = nextKeys.length ? [nextKeys[0]] : ["orig"];

  const config = readStoreConfig();
  config.activeStoreKeys = safeKeys;
  writeStoreConfig(config);
  return safeKeys;
}

function decorateDiskWithStore(disk, store) {
  if (!disk || typeof disk !== "object") return disk;
  return {
    ...disk,
    datasetKey: store?.id || null,
    datasetName: store?.name || null,
  };
}

function getMergedEnabledDiskDataset() {
  const enabledKeys = getEnabledDiskDatasetKeys();
  const merged = [];

  enabledKeys.forEach((key) => {
    const lookup = getDiskDataset(key);
    if (!lookup.data || !Array.isArray(lookup.data)) return;
    lookup.data.forEach((disk) => {
      merged.push(decorateDiskWithStore(disk, lookup.store));
    });
  });

  return {
    keys: enabledKeys,
    data: merged,
  };
}

function resolveStoreSourcePath(store) {
  if (!store?.source) return null;
  const source = String(store.source).replace(/^data[\\/]/, "");
  const fullPath = path.resolve(__dirname, source);
  if (!fullPath.startsWith(path.resolve(__dirname))) return null;
  return fullPath;
}

function assertValidSide(side) {
  if (side !== "sideA" && side !== "sideB") {
    throw new Error("Invalid side. Expected sideA or sideB.");
  }
}

function normalizeTitleList(titlesInput) {
  if (!Array.isArray(titlesInput)) {
    throw new Error("titles must be an array of game names.");
  }
  const next = titlesInput.map((title) => String(title || "").trim());
  if (next.some((title) => !title)) {
    throw new Error("All titles must be non-empty.");
  }
  return next;
}

function normalizeIncomingGameEntries(gamesInput) {
  const rawEntries = Array.isArray(gamesInput)
    ? gamesInput
    : String(gamesInput || "")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

  const normalized = rawEntries
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const gameName = String(entry.gameName || "").trim();
        if (!gameName) return null;
        const next = { gameName };
        if (entry.rating != null && !Number.isNaN(Number(entry.rating))) {
          next.rating = Number(entry.rating);
        }
        return next;
      }

      const gameName = String(entry || "").trim();
      if (!gameName) return null;
      return { gameName };
    })
    .filter(Boolean);

  if (!normalized.length) {
    throw new Error("At least one game is required.");
  }

  return normalized;
}

function persistStoreDataset(store, updatedData) {
  if (store.type === "builtin") {
    const sourcePath = resolveStoreSourcePath(store);
    if (!sourcePath) throw new Error("Invalid builtin store source path.");

    const nextContent =
      `const gameDiskData = ${JSON.stringify(updatedData, null, 2)};\n\nmodule.exports = gameDiskData;\n`;
    fs.writeFileSync(sourcePath, nextContent, "utf8");
    BUILTIN_STORES[store.id].data = updatedData;
    return;
  }

  if (store.type === "json-file") {
    const sourcePath = resolveStoreSourcePath(store);
    if (!sourcePath) throw new Error("Invalid custom store source path.");
    fs.writeFileSync(sourcePath, `${JSON.stringify(updatedData, null, 2)}\n`, "utf8");
    return;
  }

  throw new Error(`Unsupported store type: ${store.type}`);
}

function updateDiskGameTitles({ datasetKey, diskId, side, titles }) {
  assertValidSide(side);
  const normalizedTitles = normalizeTitleList(titles);

  const key = resolveDatasetKey(datasetKey || "default");
  const storeMap = getStoreDefinitionMap();
  const store = storeMap.get(key);
  if (!store) {
    throw new Error(`Unknown dataset: ${key}`);
  }

  const currentData =
    store.type === "builtin"
      ? normalizeDiskDataset(store.data)
      : readCustomStoreData(store.source);

  if (!Array.isArray(currentData)) {
    throw new Error(`Dataset '${key}' is unavailable.`);
  }

  const diskIndex = currentData.findIndex((disk) => String(disk?._id) === String(diskId));
  if (diskIndex < 0) {
    throw new Error(`Disk '${diskId}' not found in dataset '${key}'.`);
  }

  const targetDisk = currentData[diskIndex];
  const sideGames = Array.isArray(targetDisk?.[side]) ? targetDisk[side] : [];
  if (sideGames.length !== normalizedTitles.length) {
    throw new Error("Title count mismatch for selected disk side.");
  }

  const updatedSide = sideGames.map((game, index) => {
    const nextTitle = normalizedTitles[index];
    if (game && typeof game === "object") {
      return { ...game, gameName: nextTitle };
    }
    return { gameName: nextTitle };
  });

  const updatedData = currentData.map((disk, index) => (
    index === diskIndex
      ? { ...disk, [side]: updatedSide }
      : disk
  ));

  persistStoreDataset(store, updatedData);

  return {
    dataset: key,
    diskId: String(diskId),
    side,
    titles: normalizedTitles,
  };
}

function appendGamesToDiskStore({ datasetKey, diskId, side, games }) {
  assertValidSide(side);
  if (diskId == null || String(diskId).trim() === "") {
    throw new Error("diskId is required.");
  }
  const normalizedGames = normalizeIncomingGameEntries(games);

  const key = resolveDatasetKey(datasetKey || "default");
  const storeMap = getStoreDefinitionMap();
  const store = storeMap.get(key);
  if (!store) {
    throw new Error(`Unknown dataset: ${key}`);
  }

  const currentData =
    store.type === "builtin"
      ? normalizeDiskDataset(store.data)
      : readCustomStoreData(store.source);

  if (!Array.isArray(currentData)) {
    throw new Error(`Dataset '${key}' is unavailable.`);
  }

  const nextData = currentData.map((disk) => ({ ...disk }));
  const targetDiskId = String(diskId);
  let diskIndex = nextData.findIndex((disk) => String(disk?._id) === targetDiskId);

  if (diskIndex < 0) {
    nextData.push({
      _id: targetDiskId,
      sideA: [],
      sideB: [],
    });
    diskIndex = nextData.length - 1;
  }

  const targetDisk = nextData[diskIndex] || { _id: targetDiskId, sideA: [], sideB: [] };
  const existingSide = Array.isArray(targetDisk[side]) ? targetDisk[side] : [];
  const nextSide = [...existingSide, ...normalizedGames];

  nextData[diskIndex] = {
    ...targetDisk,
    _id: targetDiskId,
    sideA: side === "sideA" ? nextSide : Array.isArray(targetDisk.sideA) ? targetDisk.sideA : [],
    sideB: side === "sideB" ? nextSide : Array.isArray(targetDisk.sideB) ? targetDisk.sideB : [],
  };

  persistStoreDataset(store, nextData);

  return {
    dataset: key,
    diskId: targetDiskId,
    side,
    addedGames: normalizedGames.length,
    totalGamesOnSide: nextSide.length,
    createdDisk: diskIndex === currentData.length,
  };
}

function addJsonDiskStore({ name, key, jsonData }) {
  ensureStoreConfig();
  const config = readStoreConfig();

  const parsed = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;
  const normalizedDataset = normalizeDiskDataset(parsed);
  const requestedKey = slugifyKey(key || name || "");
  if (!requestedKey) {
    throw new Error("A valid store name or key is required.");
  }

  const allKeys = new Set(listDiskDatasetKeys().map((datasetKey) => resolveDatasetKey(datasetKey)));
  let finalKey = requestedKey;
  let suffix = 2;
  while (allKeys.has(finalKey)) {
    finalKey = `${requestedKey}-${suffix}`;
    suffix += 1;
  }

  const fileName = `${finalKey}.json`;
  const relativeFilePath = `custom-disk-stores/${fileName}`;
  const fullFilePath = path.join(CUSTOM_STORE_DIR, fileName);
  fs.writeFileSync(fullFilePath, `${JSON.stringify(normalizedDataset, null, 2)}\n`, "utf8");

  config.stores = Array.isArray(config.stores) ? config.stores : [];
  config.stores.push({
    id: finalKey,
    name: String(name || finalKey),
    type: "json-file",
    file: relativeFilePath,
    createdAt: new Date().toISOString(),
  });
  writeStoreConfig(config);

  return {
    id: finalKey,
    name: String(name || finalKey),
    type: "json-file",
    source: relativeFilePath,
    diskCount: normalizedDataset.length,
  };
}

function removeDiskFromDataset({ datasetKey, diskId }) {
  if (diskId == null || String(diskId).trim() === "") {
    throw new Error("diskId is required.");
  }

  const key = resolveDatasetKey(datasetKey || "default");
  const storeMap = getStoreDefinitionMap();
  const store = storeMap.get(key);
  if (!store) {
    throw new Error(`Unknown dataset: ${key}`);
  }

  const currentData =
    store.type === "builtin"
      ? normalizeDiskDataset(store.data)
      : readCustomStoreData(store.source);

  if (!Array.isArray(currentData)) {
    throw new Error(`Dataset '${key}' is unavailable.`);
  }

  const targetDiskId = String(diskId);
  const nextData = currentData.filter((disk) => String(disk?._id) !== targetDiskId);
  if (nextData.length === currentData.length) {
    throw new Error(`Disk '${targetDiskId}' not found in dataset '${key}'.`);
  }

  persistStoreDataset(store, nextData);

  return {
    dataset: key,
    diskId: targetDiskId,
    remainingDiskCount: nextData.length,
  };
}

function removeDiskStore(datasetKey) {
  const key = resolveDatasetKey(datasetKey || "");
  const storeMap = getStoreDefinitionMap();
  const store = storeMap.get(key);
  if (!store) {
    throw new Error(`Unknown store: ${key}`);
  }
  if (store.type === "builtin") {
    throw new Error("Built-in stores cannot be deleted.");
  }

  const config = readStoreConfig();
  const stores = Array.isArray(config.stores) ? config.stores : [];
  const nextStores = stores.filter((entry) => {
    const entryId = slugifyKey(entry?.id || entry?.key || entry?.name || "");
    return entryId !== key;
  });

  if (nextStores.length === stores.length) {
    throw new Error(`Store '${key}' was not found in configuration.`);
  }

  const sourcePath = resolveStoreSourcePath(store);
  if (sourcePath && fs.existsSync(sourcePath)) {
    fs.unlinkSync(sourcePath);
  }

  const remainingIds = new Set([
    ...Object.keys(BUILTIN_STORES),
    ...nextStores
      .map((entry) => slugifyKey(entry?.id || entry?.key || entry?.name || ""))
      .filter(Boolean),
  ]);
  const safeActive = (Array.isArray(config.activeStoreKeys) ? config.activeStoreKeys : ["orig"])
    .map((activeKey) => resolveDatasetKey(activeKey))
    .filter((activeKey) => activeKey !== key && remainingIds.has(activeKey));

  const nextActiveStoreKeys = safeActive.length ? [safeActive[0]] : ["orig"];

  writeStoreConfig({
    ...config,
    stores: nextStores,
    activeStoreKeys: nextActiveStoreKeys,
  });

  return {
    deletedStoreKey: key,
    activeStoreKeys: nextActiveStoreKeys,
  };
}

module.exports = {
  addJsonDiskStore,
  appendGamesToDiskStore,
  getDiskDataset,
  getEnabledDiskDatasetKeys,
  getMergedEnabledDiskDataset,
  listDiskDatasetKeys,
  listDiskStores,
  normalizeDatasetKey,
  removeDiskFromDataset,
  removeDiskStore,
  setEnabledDiskDatasetKeys,
  updateDiskGameTitles,
};
