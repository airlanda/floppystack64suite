import { openDatabaseAsync } from "expo-sqlite";
import * as FileSystem from "expo-file-system";

const DB_NAME = "floppystack64.db";
const DB_SCHEMA_VERSION = 4;
let dbPromise = null;

function normalizeGameKey(item, fallbackIndex = 0) {
  if (item?.key) return String(item.key);
  const safeName = String(item?.gameName || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
  return `${safeName}::${fallbackIndex}`;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

function normalizeYearValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function normalizePlayersValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^(19|20)\d{2}$/.test(text)) return null;
  return text;
}

function normalizeMetaFields(metadata = {}) {
  const rawYear = metadata?.year;
  const rawPlayers = metadata?.players;

  let year = normalizeYearValue(rawYear);
  let players = normalizePlayersValue(rawPlayers);

  // Heuristic repair for occasional provider field crossover.
  if (!year) {
    const playersAsYear = normalizeYearValue(rawPlayers);
    if (playersAsYear) {
      year = playersAsYear;
      players = normalizePlayersValue(rawYear);
    }
  }

  return { year, players };
}

function normalizeLoadedFields({ description, year, players }) {
  let nextDescription = description == null ? "" : String(description).trim();
  let nextYear = year == null ? "" : String(year).trim();
  let nextPlayers = players == null ? "" : String(players).trim();

  const normalizedYear = normalizeYearValue(nextYear);
  const normalizedPlayers = normalizePlayersValue(nextPlayers);

  // Repair legacy shifted rows:
  // - description text ended up in year
  // - year ended up in players
  const playersLooksLikeYear = Boolean(normalizeYearValue(nextPlayers));
  const yearLooksVerbose = nextYear.length > 6;
  if ((!normalizedYear && playersLooksLikeYear) || (yearLooksVerbose && playersLooksLikeYear)) {
    const originalYearField = nextYear;
    const originalPlayersField = nextPlayers;
    if (!nextDescription && nextYear) {
      nextDescription = nextYear;
    }
    nextYear = normalizeYearValue(originalPlayersField) || "";
    nextPlayers = normalizePlayersValue(originalYearField) || "";
  } else {
    nextYear = normalizedYear || "";
    nextPlayers = normalizedPlayers || "";
  }

  return {
    description: nextDescription,
    year: nextYear,
    players: nextPlayers,
  };
}

async function ensureColumn(db, tableName, columnName, columnDefSql) {
  const info = await db.getAllAsync(`PRAGMA table_info(${tableName})`);
  const hasColumn = Array.isArray(info) && info.some((col) => col?.name === columnName);
  if (!hasColumn) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefSql};`);
  }
}

async function runMetadataRepairMigration(db) {
  const rows = await db.getAllAsync(
    `
      SELECT gameKey, description, year, players
      FROM games
    `
  );

  if (!Array.isArray(rows) || !rows.length) return;

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const row of rows) {
      const repaired = normalizeLoadedFields({
        description: row.description,
        year: row.year,
        players: row.players,
      });

      const prevDescription = row.description == null ? "" : String(row.description).trim();
      const prevYear = row.year == null ? "" : String(row.year).trim();
      const prevPlayers = row.players == null ? "" : String(row.players).trim();

      const changed =
        repaired.description !== prevDescription ||
        repaired.year !== prevYear ||
        repaired.players !== prevPlayers;

      if (!changed) continue;

      await tx.runAsync(
        `
          UPDATE games
          SET
            description = ?,
            year = ?,
            players = ?,
            updatedAt = ?
          WHERE gameKey = ?
        `,
        repaired.description || null,
        repaired.year || null,
        repaired.players || null,
        new Date().toISOString(),
        row.gameKey
      );
    }
  });
}

export async function initLocalDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS games (
      gameKey TEXT PRIMARY KEY NOT NULL,
      gameName TEXT NOT NULL,
      canonicalTitle TEXT,
      description TEXT,
      rating REAL DEFAULT 0,
      year TEXT,
      players TEXT,
      genre TEXT,
      publisher TEXT,
      developer TEXT,
      boxFront TEXT,
      boxFrontLocal TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameKey TEXT NOT NULL,
      diskId INTEGER,
      sideLabel TEXT,
      slot INTEGER,
      datasetKey TEXT,
      FOREIGN KEY(gameKey) REFERENCES games(gameKey) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opType TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      settingKey TEXT PRIMARY KEY NOT NULL,
      settingValue TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_games_name ON games(gameName);
    CREATE INDEX IF NOT EXISTS idx_locations_gameKey ON locations(gameKey);
  `);

  await ensureColumn(db, "games", "description", "TEXT");
  await ensureColumn(db, "games", "boxFrontLocal", "TEXT");
  await ensureColumn(db, "games", "rating", "REAL DEFAULT 0");

  const versionRow = await db.getFirstAsync(`PRAGMA user_version`);
  const currentVersion = Number(versionRow?.user_version || 0);
  if (currentVersion < DB_SCHEMA_VERSION) {
    await runMetadataRepairMigration(db);
    await db.execAsync(`PRAGMA user_version = ${DB_SCHEMA_VERSION}`);
  }
}

function resolveRemoteImageUrl(rawUrl, apiBaseUrl) {
  const text = String(rawUrl || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("//")) return `https:${text}`;
  if (text.startsWith("/")) {
    const base = String(apiBaseUrl || "").trim().replace(/\/+$/, "");
    return base ? `${base}${text}` : "";
  }
  return text;
}

function extractImageExtension(urlText) {
  const path = String(urlText || "").split("?")[0];
  const match = path.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  const ext = match ? match[1].toLowerCase() : "jpg";
  return ext === "jpeg" ? "jpg" : ext;
}

export async function ensureGameBoxArtCached(gameKey, apiBaseUrl = "") {
  const db = await getDb();
  const key = String(gameKey || "").trim();
  if (!key) return "";

  const row = await db.getFirstAsync(
    `
      SELECT gameKey, boxFront, boxFrontLocal
      FROM games
      WHERE gameKey = ?
      LIMIT 1
    `,
    key
  );
  if (!row) return "";

  const existingLocal = String(row.boxFrontLocal || "").trim();
  if (existingLocal) {
    try {
      const info = await FileSystem.getInfoAsync(existingLocal);
      if (info?.exists) return existingLocal;
    } catch {
      // Continue and recache.
    }
  }

  const remoteUrl = resolveRemoteImageUrl(row.boxFront, apiBaseUrl);
  if (!remoteUrl) return "";

  const boxDir = `${FileSystem.documentDirectory}boxart`;
  try {
    await FileSystem.makeDirectoryAsync(boxDir, { intermediates: true });
  } catch {
    // Directory may already exist.
  }

  const ext = extractImageExtension(remoteUrl);
  const safeKey = key.replace(/[^\w.-]/g, "_");
  const fileUri = `${boxDir}/${safeKey}.${ext}`;

  try {
    await FileSystem.downloadAsync(remoteUrl, fileUri);
    await db.runAsync(
      `
        UPDATE games
        SET boxFrontLocal = ?, updatedAt = ?
        WHERE gameKey = ?
      `,
      fileUri,
      new Date().toISOString(),
      key
    );
    return fileUri;
  } catch {
    return "";
  }
}

export async function getSetting(settingKey, fallbackValue = "") {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `
      SELECT settingValue
      FROM app_settings
      WHERE settingKey = ?
      LIMIT 1
    `,
    String(settingKey || "")
  );
  if (!row || row.settingValue == null || row.settingValue === "") return fallbackValue;
  return String(row.settingValue);
}

export async function setSetting(settingKey, settingValue) {
  const db = await getDb();
  await db.runAsync(
    `
      INSERT INTO app_settings (settingKey, settingValue)
      VALUES (?, ?)
      ON CONFLICT(settingKey) DO UPDATE SET
        settingValue = excluded.settingValue
    `,
    String(settingKey || ""),
    settingValue == null ? "" : String(settingValue)
  );
}

export async function upsertGamesFromApi(results) {
  const db = await getDb();
  const list = Array.isArray(results) ? results : [];
  const nowIso = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i] || {};
      const gameKey = normalizeGameKey(item, i);
      const metadata = item.metadata || {};
      const images = metadata.images || {};
      const normalized = normalizeMetaFields(metadata);

      await tx.runAsync(
        `
          INSERT INTO games (
            gameKey, gameName, canonicalTitle, description, rating, year, players, genre, publisher, developer, boxFront, updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(gameKey) DO UPDATE SET
            gameName = excluded.gameName,
            canonicalTitle = excluded.canonicalTitle,
            description = excluded.description,
            rating = COALESCE(games.rating, excluded.rating),
            year = excluded.year,
            players = excluded.players,
            genre = excluded.genre,
            publisher = excluded.publisher,
            developer = excluded.developer,
            boxFront = excluded.boxFront,
            updatedAt = excluded.updatedAt
        `,
        gameKey,
        String(item.gameName || "Untitled"),
        metadata.canonicalTitle || null,
        metadata.description || null,
        Number.isFinite(Number(item?.rating)) ? Number(item.rating) : 0,
        normalized.year,
        normalized.players,
        metadata.genre || null,
        metadata.publisher || null,
        metadata.developer || null,
        images.boxFront || images.screenshot || null,
        nowIso
      );

      await tx.runAsync(`DELETE FROM locations WHERE gameKey = ?`, gameKey);

      const locations = Array.isArray(item.locations) ? item.locations : [];
      for (const location of locations) {
        await tx.runAsync(
          `
            INSERT INTO locations (gameKey, diskId, sideLabel, slot, datasetKey)
            VALUES (?, ?, ?, ?, ?)
          `,
          gameKey,
          location?.diskId ?? null,
          location?.sideLabel ?? null,
          location?.slot ?? null,
          location?.datasetKey ?? null
        );
      }
    }
  });
}

export async function replaceDiskInventoryFromApi(disks) {
  const db = await getDb();
  const list = Array.isArray(disks) ? disks : [];
  const nowIso = new Date().toISOString();
  const existingRatings = new Map();
  const ratingRows = await db.getAllAsync(
    `
      SELECT gameKey, rating
      FROM games
      WHERE rating IS NOT NULL
    `
  );

  for (const row of ratingRows || []) {
    const key = String(row?.gameKey || "").trim();
    if (!key) continue;
    existingRatings.set(key, Number(row?.rating || 0));
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(`DELETE FROM locations`);
    await tx.runAsync(`DELETE FROM games`);

    for (const disk of list) {
      const diskId = Number(disk?._id ?? disk?.diskId);
      const datasetKey = String(disk?.datasetKey || "default");
      if (!Number.isFinite(diskId)) continue;

      for (const sideKey of ["sideA", "sideB"]) {
        const sideItems = Array.isArray(disk?.[sideKey]) ? disk[sideKey] : [];
        const sideLabel = sideKey === "sideB" ? "B" : "A";

        for (let index = 0; index < sideItems.length; index += 1) {
          const rawItem = sideItems[index];
          const gameObject = rawItem && typeof rawItem === "object" ? rawItem : { gameName: rawItem };
          const gameName = String(gameObject?.gameName || "").trim();
          if (!gameName) continue;

          const gameKey =
            String(gameObject?.key || "").trim() ||
            `${datasetKey}|${diskId}|${sideKey}|${index}|${gameName.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}`;
          const preservedRating = existingRatings.has(gameKey)
            ? Number(existingRatings.get(gameKey) || 0)
            : Number.isFinite(Number(gameObject?.rating))
              ? Number(gameObject.rating)
              : 0;

          await tx.runAsync(
            `
              INSERT INTO games (
                gameKey, gameName, canonicalTitle, description, rating, year, players, genre, publisher, developer, boxFront, updatedAt
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(gameKey) DO UPDATE SET
                gameName = excluded.gameName,
                canonicalTitle = COALESCE(games.canonicalTitle, excluded.canonicalTitle),
                description = COALESCE(games.description, excluded.description),
                rating = excluded.rating,
                year = COALESCE(games.year, excluded.year),
                players = COALESCE(games.players, excluded.players),
                genre = COALESCE(games.genre, excluded.genre),
                publisher = COALESCE(games.publisher, excluded.publisher),
                developer = COALESCE(games.developer, excluded.developer),
                boxFront = COALESCE(games.boxFront, excluded.boxFront),
                updatedAt = excluded.updatedAt
            `,
            gameKey,
            gameName,
            gameObject?.canonicalTitle || null,
            gameObject?.description || null,
            preservedRating,
            normalizeYearValue(gameObject?.year),
            normalizePlayersValue(gameObject?.players),
            gameObject?.genre || null,
            gameObject?.publisher || null,
            gameObject?.developer || null,
            gameObject?.images?.boxFront || gameObject?.boxFront || null,
            nowIso
          );

          await tx.runAsync(
            `
              INSERT INTO locations (gameKey, diskId, sideLabel, slot, datasetKey)
              VALUES (?, ?, ?, ?, ?)
            `,
            gameKey,
            diskId,
            sideLabel,
            index,
            datasetKey
          );
        }
      }
    }
  });
}

export async function upsertSingleGameFromLookup({ gameName, metadata }) {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const gameKey = normalizeGameKey({ gameName }, 0);
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const images = meta.images && typeof meta.images === "object" ? meta.images : {};
  const normalized = normalizeMetaFields(meta);

  await db.runAsync(
    `
      INSERT INTO games (
        gameKey, gameName, canonicalTitle, description, rating, year, players, genre, publisher, developer, boxFront, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(gameKey) DO UPDATE SET
        gameName = excluded.gameName,
        canonicalTitle = excluded.canonicalTitle,
        description = excluded.description,
        rating = COALESCE(games.rating, excluded.rating),
        year = excluded.year,
        players = excluded.players,
        genre = excluded.genre,
        publisher = excluded.publisher,
        developer = excluded.developer,
        boxFront = excluded.boxFront,
        updatedAt = excluded.updatedAt
    `,
    gameKey,
    String(gameName || "Untitled"),
    meta.canonicalTitle || gameName || null,
    meta.description || null,
    0,
    normalized.year,
    normalized.players,
    meta.genre || null,
    meta.publisher || null,
    meta.developer || null,
    images.boxFront || images.screenshot || null,
    nowIso
  );

  return gameKey;
}

export async function searchCachedGames(query, limit = 200) {
  const db = await getDb();
  const q = String(query || "").trim();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, limit)) : 200;

  const rows = await db.getAllAsync(
    `
      SELECT
        g.gameKey,
        g.gameName,
        g.canonicalTitle,
        g.description,
        g.rating,
        g.year,
        g.players,
        g.genre,
        g.publisher,
        g.developer,
        g.boxFront,
        g.boxFrontLocal,
        l.diskId,
        l.sideLabel,
        l.slot,
        l.datasetKey
      FROM games g
      LEFT JOIN locations l
        ON l.id = (
          SELECT id
          FROM locations
          WHERE gameKey = g.gameKey
          ORDER BY id ASC
          LIMIT 1
        )
      WHERE (
        ? = '' OR
        g.gameName LIKE '%' || ? || '%' OR
        g.canonicalTitle LIKE '%' || ? || '%'
      )
      ORDER BY g.gameName COLLATE NOCASE ASC
      LIMIT ?
    `,
    q,
    q,
    q,
    safeLimit
  );

  return rows.map((row) => ({
    key: row.gameKey,
    gameName: row.gameName,
    metadata: {
      canonicalTitle: row.canonicalTitle,
      description: row.description,
      rating: Number(row.rating || 0),
      year: row.year,
      players: row.players,
      genre: row.genre,
      publisher: row.publisher,
      developer: row.developer,
      images: {
        boxFront: row.boxFrontLocal || row.boxFront,
        boxFrontLocal: row.boxFrontLocal || null,
        boxFrontRemote: row.boxFront || null,
      },
    },
    locations:
      row.diskId == null
        ? []
        : [
            {
              diskId: row.diskId,
              sideLabel: row.sideLabel || "",
              slot: row.slot,
              datasetKey: row.datasetKey || null,
            },
          ],
  }));
}

export async function queueTitleEdit({ gameKey, gameName, canonicalTitle }) {
  const db = await getDb();
  const payload = {
    gameName: String(gameName || "").trim(),
    canonicalTitle: String(canonicalTitle || "").trim(),
  };
  if (!payload.gameName || !payload.canonicalTitle) {
    throw new Error("gameName and canonicalTitle are required");
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `
        UPDATE games
        SET canonicalTitle = ?, updatedAt = ?
        WHERE gameKey = ?
      `,
      payload.canonicalTitle,
      new Date().toISOString(),
      gameKey
    );

    await tx.runAsync(
      `
        INSERT INTO sync_queue (opType, payload, createdAt, status)
        VALUES (?, ?, ?, 'pending')
      `,
      "UPSERT_METADATA_TITLE",
      JSON.stringify(payload),
      new Date().toISOString()
    );
  });
}

export async function getCachedGameDetail(gameKey) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `
      SELECT
        gameKey,
        gameName,
        canonicalTitle,
        description,
        rating,
        year,
        players,
        genre,
        publisher,
        developer,
        boxFront,
        boxFrontLocal
      FROM games
      WHERE gameKey = ?
      LIMIT 1
    `,
    gameKey
  );

  if (!row) return null;

  const normalized = normalizeLoadedFields({
    description: row.description,
    year: row.year,
    players: row.players,
  });

  const locations = await db.getAllAsync(
    `
      SELECT diskId, sideLabel, slot, datasetKey
      FROM locations
      WHERE gameKey = ?
      ORDER BY COALESCE(slot, 9999) ASC
    `,
    gameKey
  );

  return {
    key: row.gameKey,
    gameName: row.gameName,
    metadata: {
      canonicalTitle: row.canonicalTitle,
      description: normalized.description,
      rating: Number(row.rating || 0),
      year: normalized.year,
      players: normalized.players,
      genre: row.genre,
      publisher: row.publisher,
      developer: row.developer,
      images: {
        boxFront: row.boxFrontLocal || row.boxFront,
        boxFrontLocal: row.boxFrontLocal || null,
        boxFrontRemote: row.boxFront || null,
      },
    },
    locations: Array.isArray(locations)
      ? locations.map((loc) => ({
          diskId: loc.diskId,
          sideLabel: loc.sideLabel || "",
          slot: loc.slot,
          datasetKey: loc.datasetKey || null,
        }))
      : [],
  };
}

export async function queueMetadataEdit({ gameKey, gameName, metadata }) {
  const db = await getDb();
  const payload = {
    gameName: String(gameName || "").trim(),
    metadata: {
      canonicalTitle: metadata?.canonicalTitle ? String(metadata.canonicalTitle).trim() : "",
      description: metadata?.description != null ? String(metadata.description) : "",
      year: metadata?.year != null ? String(metadata.year).trim() : "",
      players: metadata?.players != null ? String(metadata.players).trim() : "",
      genre: metadata?.genre != null ? String(metadata.genre).trim() : "",
      publisher: metadata?.publisher != null ? String(metadata.publisher).trim() : "",
      developer: metadata?.developer != null ? String(metadata.developer).trim() : "",
    },
  };
  if (!payload.gameName) {
    throw new Error("gameName is required");
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `
        UPDATE games
        SET
          canonicalTitle = ?,
          description = ?,
          year = ?,
          players = ?,
          genre = ?,
          publisher = ?,
          developer = ?,
          updatedAt = ?
        WHERE gameKey = ?
      `,
      payload.metadata.canonicalTitle || null,
      payload.metadata.description || null,
      payload.metadata.year || null,
      payload.metadata.players || null,
      payload.metadata.genre || null,
      payload.metadata.publisher || null,
      payload.metadata.developer || null,
      new Date().toISOString(),
      gameKey
    );

    await tx.runAsync(
      `
        INSERT INTO sync_queue (opType, payload, createdAt, status)
        VALUES (?, ?, ?, 'pending')
      `,
      "UPSERT_METADATA_FIELDS",
      JSON.stringify(payload),
      new Date().toISOString()
    );
  });
}

export async function getPendingSyncCount() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `
      SELECT COUNT(*) AS count
      FROM sync_queue
      WHERE status IN ('pending', 'failed')
    `
  );
  return Number(row?.count || 0);
}

export async function getSyncQueueStats() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `
      SELECT status, COUNT(*) AS count
      FROM sync_queue
      GROUP BY status
    `
  );

  const stats = {
    pending: 0,
    failed: 0,
    synced: 0,
    total: 0,
  };

  for (const row of rows || []) {
    const status = String(row?.status || "").toLowerCase();
    const count = Number(row?.count || 0);
    if (status === "pending") stats.pending = count;
    else if (status === "failed") stats.failed = count;
    else if (status === "synced") stats.synced = count;
    stats.total += count;
  }

  return stats;
}

export async function pushPendingOps(apiBaseUrl) {
  const db = await getDb();
  const ops = await db.getAllAsync(
    `
      SELECT id, opType, payload
      FROM sync_queue
      WHERE status IN ('pending', 'failed')
      ORDER BY id ASC
    `
  );

  let pushed = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      const payload = JSON.parse(String(op.payload || "{}"));
      let body = null;

      if (op.opType === "UPSERT_METADATA_TITLE") {
        body = {
          gameName: payload.gameName,
          platform: "c64",
          metadata: {
            canonicalTitle: payload.canonicalTitle,
          },
        };
      } else if (op.opType === "UPSERT_METADATA_FIELDS") {
        body = {
          gameName: payload.gameName,
          platform: "c64",
          metadata: {
            canonicalTitle: payload.metadata?.canonicalTitle || payload.gameName,
            description: payload.metadata?.description || null,
            year: payload.metadata?.year || null,
            players: payload.metadata?.players || null,
            genre: payload.metadata?.genre || null,
            publisher: payload.metadata?.publisher || null,
            developer: payload.metadata?.developer || null,
          },
        };
      } else {
        await db.runAsync(`UPDATE sync_queue SET status = 'failed' WHERE id = ?`, op.id);
        failed += 1;
        continue;
      }

      const response = await fetch(`${apiBaseUrl}/api/metadata/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await db.runAsync(`UPDATE sync_queue SET status = 'synced' WHERE id = ?`, op.id);
      pushed += 1;
    } catch (_err) {
      await db.runAsync(`UPDATE sync_queue SET status = 'failed' WHERE id = ?`, op.id);
      failed += 1;
    }
  }

  return { pushed, failed, total: ops.length };
}

export async function getCachedDiskInventory() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `
      SELECT
        l.diskId,
        l.sideLabel,
        l.slot,
        l.datasetKey,
        g.gameKey,
        g.gameName,
        g.canonicalTitle
        ,
        g.rating
      FROM locations l
      INNER JOIN games g
        ON g.gameKey = l.gameKey
      WHERE l.diskId IS NOT NULL
      ORDER BY
        l.diskId ASC,
        CASE UPPER(COALESCE(l.sideLabel, '')) WHEN 'A' THEN 0 WHEN 'B' THEN 1 ELSE 2 END ASC,
        COALESCE(l.slot, 9999) ASC,
        g.gameName COLLATE NOCASE ASC
    `
  );

  const diskMap = new Map();
  for (const row of rows) {
    const diskId = Number(row.diskId);
    const side = String(row.sideLabel || "").toUpperCase() === "B" ? "B" : "A";
    if (!diskMap.has(diskId)) {
      diskMap.set(diskId, {
        diskId,
        datasetKey: row.datasetKey || null,
        sideA: [],
        sideB: [],
      });
    }

    const disk = diskMap.get(diskId);
    const entry = {
      key: row.gameKey,
      gameName: row.gameName,
      canonicalTitle: row.canonicalTitle || null,
      rating: Number(row.rating || 0),
      slot: row.slot ?? null,
      sideLabel: side,
    };

    if (side === "B") disk.sideB.push(entry);
    else disk.sideA.push(entry);
  }

  return Array.from(diskMap.values());
}

export async function updateDiskSideTitlesLocal({ diskId, side, titles, datasetKey = "" }) {
  const db = await getDb();
  const numericDiskId = Number(diskId);
  const sideLetter = String(side || "").toLowerCase() === "sideb" ? "B" : "A";
  const nextTitles = Array.isArray(titles) ? titles.map((t) => String(t || "").trim()) : [];

  if (!Number.isFinite(numericDiskId)) {
    throw new Error("Invalid diskId");
  }

  const rows = await db.getAllAsync(
    `
      SELECT l.gameKey, l.slot, l.datasetKey
      FROM locations l
      WHERE l.diskId = ?
        AND UPPER(COALESCE(l.sideLabel, '')) = ?
      ORDER BY COALESCE(l.slot, 9999) ASC, l.id ASC
    `,
    numericDiskId,
    sideLetter
  );

  const filteredRows = String(datasetKey || "").trim()
    ? rows.filter((row) => String(row.datasetKey || "") === String(datasetKey || ""))
    : rows;

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (let i = 0; i < filteredRows.length; i += 1) {
      const row = filteredRows[i];
      const title = nextTitles[i];
      if (!title) continue;
      await tx.runAsync(
        `
          UPDATE games
          SET gameName = ?, updatedAt = ?
          WHERE gameKey = ?
        `,
        title,
        new Date().toISOString(),
        row.gameKey
      );
    }
  });
}

export async function updateGameRatingLocal({ gameKey, rating }) {
  const db = await getDb();
  const key = String(gameKey || "").trim();
  if (!key) {
    throw new Error("Invalid gameKey");
  }
  const nextRating = Number.isFinite(Number(rating))
    ? Math.max(0, Math.min(5, Number(rating)))
    : 0;

  await db.runAsync(
    `
      UPDATE games
      SET rating = ?, updatedAt = ?
      WHERE gameKey = ?
    `,
    nextRating,
    new Date().toISOString(),
    key
  );
}

export async function removeDiskLocal({ diskId, datasetKey = "" }) {
  const db = await getDb();
  const numericDiskId = Number(diskId);
  if (!Number.isFinite(numericDiskId)) {
    throw new Error("Invalid diskId");
  }

  const locationRows = await db.getAllAsync(
    `
      SELECT id, gameKey, datasetKey
      FROM locations
      WHERE diskId = ?
    `,
    numericDiskId
  );

  const matches = String(datasetKey || "").trim()
    ? locationRows.filter((row) => String(row.datasetKey || "") === String(datasetKey || ""))
    : locationRows;

  if (!matches.length) return { removedLocations: 0, removedGames: 0 };

  const gameKeys = Array.from(new Set(matches.map((row) => String(row.gameKey || "")).filter(Boolean)));
  const locationIds = matches.map((row) => row.id).filter((id) => Number.isFinite(Number(id)));

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const id of locationIds) {
      await tx.runAsync(`DELETE FROM locations WHERE id = ?`, id);
    }
  });

  // Delete orphaned games with no remaining locations.
  let removedGames = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const gameKey of gameKeys) {
      const exists = await tx.getFirstAsync(
        `
          SELECT 1 AS hit
          FROM locations
          WHERE gameKey = ?
          LIMIT 1
        `,
        gameKey
      );
      if (!exists) {
        await tx.runAsync(`DELETE FROM games WHERE gameKey = ?`, gameKey);
        removedGames += 1;
      }
    }
  });

  return { removedLocations: locationIds.length, removedGames };
}
