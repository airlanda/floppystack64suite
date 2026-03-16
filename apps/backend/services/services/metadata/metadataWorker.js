const { getDiskDataset } = require("../../data/diskDatasets");
const {
  createJob,
  getJob,
  listJobs,
  updateJob,
  findNextQueuedJob,
} = require("../../data/metadataJobsStore");
const { makeMetadataKey, upsertMetadataRecord } = require("../../data/metadataStore");
const { getMetadataProvider } = require("./providerRegistry");

let pollTimer = null;
let isProcessing = false;

function collectTargetsFromDataset({ datasetKey, data, diskId = null }) {
  const targets = [];
  const disks = Array.isArray(data) ? data : [];

  disks.forEach((disk) => {
    if (!disk || typeof disk !== "object") return;
    if (diskId != null && String(disk._id) !== String(diskId)) return;

    ["sideA", "sideB"].forEach((side) => {
      const games = Array.isArray(disk[side]) ? disk[side] : [];
      games.forEach((game, gameIndex) => {
        const gameName = game && typeof game === "object" ? game.gameName : game;
        if (!gameName) return;

        targets.push({
          dataset: datasetKey,
          diskId: String(disk._id),
          side,
          gameIndex,
          gameName: String(gameName),
          metadataKey: makeMetadataKey({ platform: "c64", gameName }),
        });
      });
    });
  });

  return targets;
}

function dedupeByMetadataKey(targets) {
  const seen = new Set();
  const unique = [];

  targets.forEach((target) => {
    if (seen.has(target.metadataKey)) return;
    seen.add(target.metadataKey);
    unique.push(target);
  });

  return unique;
}

async function processJob(job) {
  const provider = getMetadataProvider(job.provider);
  const datasetLookup = getDiskDataset(job.dataset);
  const dataset = datasetLookup.data;

  if (!dataset) {
    throw new Error(`Unknown dataset: ${job.dataset}`);
  }

  let targets = collectTargetsFromDataset({
    datasetKey: datasetLookup.key,
    data: dataset,
    diskId: job.type === "scrapeDisk" ? job.diskId : null,
  });

  if (job.type === "scrapeGame" && job.gameName) {
    const needle = String(job.gameName).trim().toLowerCase();
    targets = targets.filter((t) => t.gameName.toLowerCase().includes(needle));
  }

  targets = dedupeByMetadataKey(targets);

  await updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    progress: { total: targets.length, completed: 0, skipped: 0, failed: 0, current: null },
  });

  let resultCreated = 0;
  let resultUpdated = 0;
  let resultFailed = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];

    await updateJob(job.id, {
      progress: {
        total: targets.length,
        completed: index,
        current: `${target.gameName} (${target.diskId} ${target.side})`,
      },
    });

    try {
      const metadata = await provider.fetchGameMetadata(target, job.options || {});
      const stored = await upsertMetadataRecord({
        key: target.metadataKey,
        platform: "c64",
        gameName: target.gameName,
        canonicalTitle: metadata?.canonicalTitle ?? target.gameName,
        description: metadata?.description ?? null,
        genre: metadata?.genre ?? null,
        developer: metadata?.developer ?? null,
        publisher: metadata?.publisher ?? null,
        year: metadata?.year ?? null,
        players: metadata?.players ?? null,
        images: metadata?.images || {},
        source: metadata?.source || {
          provider: provider.name || "mock",
          status: "fetched",
          matchConfidence: null,
          lastFetchedAt: new Date().toISOString(),
        },
      });

      if (stored?.createdAt === stored?.updatedAt) resultCreated += 1;
      else resultUpdated += 1;
    } catch (error) {
      resultFailed += 1;
      await updateJob(job.id, {
        progress: {
          total: targets.length,
          completed: index,
          failed: resultFailed,
          current: `${target.gameName} (${target.diskId} ${target.side})`,
        },
      });
    }
  }

  await updateJob(job.id, {
    status: "completed",
    finishedAt: new Date().toISOString(),
    progress: {
      total: targets.length,
      completed: targets.length,
      current: null,
      failed: resultFailed,
    },
    result: {
      created: resultCreated,
      updated: resultUpdated,
      failed: resultFailed,
      skipped: 0,
    },
  });
}

async function processNextQueuedJob() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const job = await findNextQueuedJob();
    if (!job) return;

    try {
      await processJob(job);
    } catch (error) {
      await updateJob(job.id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error.message || "Metadata job failed",
      });
    }
  } finally {
    isProcessing = false;
  }
}

function startMetadataWorker({ pollIntervalMs = 1200 } = {}) {
  if (pollTimer) return;

  pollTimer = setInterval(() => {
    processNextQueuedJob().catch((error) => {
      console.error("Metadata worker loop error:", error);
    });
  }, pollIntervalMs);

  // Kick once immediately.
  processNextQueuedJob().catch((error) => {
    console.error("Metadata worker startup error:", error);
  });
}

function stopMetadataWorker() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

async function enqueueMetadataJob(input) {
  return createJob({
    type: input.type || "scrapeAllMissing",
    provider: input.provider || process.env.METADATA_DEFAULT_PROVIDER || "hybrid",
    dataset: input.dataset || "default",
    diskId: input.diskId || null,
    gameName: input.gameName || null,
    options: input.options || {},
  });
}

module.exports = {
  startMetadataWorker,
  stopMetadataWorker,
  enqueueMetadataJob,
  getMetadataJob: getJob,
  listMetadataJobs: listJobs,
};
