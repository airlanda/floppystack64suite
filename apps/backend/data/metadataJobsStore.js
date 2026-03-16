const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const jobsFilePath = path.join(__dirname, "metadata-jobs.json");

async function ensureFile() {
  try {
    await fs.promises.access(jobsFilePath);
  } catch (_err) {
    await fs.promises.writeFile(jobsFilePath, "{}\n", "utf8");
  }
}

async function readJobsStore() {
  await ensureFile();
  const raw = await fs.promises.readFile(jobsFilePath, "utf8");
  if (!raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

async function writeJobsStore(data) {
  await fs.promises.writeFile(jobsFilePath, `${JSON.stringify(data || {}, null, 2)}\n`, "utf8");
}

function createJobId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

async function createJob(input) {
  const store = await readJobsStore();
  const id = createJobId();
  const now = new Date().toISOString();

  const job = {
    id,
    type: input.type,
    status: "queued",
    provider: input.provider || "mock",
    dataset: input.dataset || "default",
    diskId: input.diskId != null ? String(input.diskId) : null,
    gameName: input.gameName || null,
    options: input.options || {},
    progress: {
      total: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      current: null,
    },
    result: {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    error: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
  };

  store[id] = job;
  await writeJobsStore(store);
  return job;
}

async function getJob(jobId) {
  const store = await readJobsStore();
  return store[jobId] || null;
}

async function listJobs() {
  const store = await readJobsStore();
  return Object.values(store).sort((a, b) => {
    const aTime = Date.parse(a?.createdAt || 0);
    const bTime = Date.parse(b?.createdAt || 0);
    return bTime - aTime;
  });
}

async function updateJob(jobId, patch) {
  const store = await readJobsStore();
  const current = store[jobId];
  if (!current) return null;

  const next = {
    ...current,
    ...patch,
    progress: {
      ...current.progress,
      ...(patch.progress || {}),
    },
    result: {
      ...current.result,
      ...(patch.result || {}),
    },
  };

  store[jobId] = next;
  await writeJobsStore(store);
  return next;
}

async function findNextQueuedJob() {
  const jobs = await listJobs();
  return jobs.find((job) => job.status === "queued") || null;
}

module.exports = {
  createJob,
  getJob,
  listJobs,
  updateJob,
  findNextQueuedJob,
};
