const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROGRESS_PATH = path.resolve(__dirname, "player-progress.json");

function ensureFile() {
  if (fs.existsSync(PROGRESS_PATH)) return;
  fs.writeFileSync(PROGRESS_PATH, "{}\n", "utf8");
}

function readStore() {
  ensureFile();
  const raw = fs.readFileSync(PROGRESS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function writeStore(nextStore) {
  fs.writeFileSync(PROGRESS_PATH, `${JSON.stringify(nextStore, null, 2)}\n`, "utf8");
}

function defaultProgress() {
  return {
    stats: {
      challengesStarted: 0,
      challengesCompleted: 0,
      wins: 0,
    },
    badges: [],
    activeChallenge: null,
    events: [],
    updatedAt: new Date().toISOString(),
  };
}

function defaultGamificationState() {
  return {
    activeChallenge: null,
    recentSelections: [],
    playSessions: [],
    badges: [],
    preferences: {
      defaultMode: "random",
    },
    stats: {
      totalPlayed: 0,
      totalWins: 0,
    },
  };
}

function sanitizeGamificationState(input) {
  const base = defaultGamificationState();
  const next = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...next,
    recentSelections: Array.isArray(next.recentSelections) ? next.recentSelections.slice(0, 30) : [],
    playSessions: Array.isArray(next.playSessions) ? next.playSessions.slice(0, 250) : [],
    badges: Array.isArray(next.badges) ? next.badges.slice(0, 250) : [],
    preferences: {
      ...base.preferences,
      ...(next.preferences && typeof next.preferences === "object" ? next.preferences : {}),
    },
    stats: {
      ...base.stats,
      ...(next.stats && typeof next.stats === "object" ? next.stats : {}),
    },
  };
}

function getProgressForUser(userId) {
  const store = readStore();
  return store[userId] || defaultProgress();
}

function getGamificationStateForUser(userId) {
  const store = readStore();
  const current = store[userId] || defaultProgress();
  return sanitizeGamificationState(current.gamification || {});
}

function setGamificationStateForUser(userId, stateInput) {
  const store = readStore();
  const current = store[userId] || defaultProgress();
  const next = {
    ...current,
    gamification: sanitizeGamificationState(stateInput),
    updatedAt: new Date().toISOString(),
  };
  store[userId] = next;
  writeStore(store);
  return next.gamification;
}

function getGamificationStandings(limit = 50) {
  const store = readStore();
  const entries = Object.entries(store).map(([userId, record]) => {
    const gamification = sanitizeGamificationState(record?.gamification || {});
    const totalPlayed = Number(gamification?.stats?.totalPlayed || 0);
    const totalWins = Number(gamification?.stats?.totalWins || 0);
    return {
      userId,
      totalPlayed,
      totalWins,
      winRate: totalPlayed > 0 ? totalWins / totalPlayed : 0,
    };
  });

  return entries
    .sort((a, b) => {
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalPlayed - a.totalPlayed;
    })
    .slice(0, Math.max(1, Number(limit || 1)));
}

function appendEvent(userId, eventType, payload = {}) {
  const store = readStore();
  const current = store[userId] || defaultProgress();
  const next = { ...current };
  const now = new Date().toISOString();

  const event = {
    id: crypto.randomUUID(),
    type: String(eventType || "").trim(),
    payload: payload && typeof payload === "object" ? payload : {},
    createdAt: now,
  };

  next.events = Array.isArray(current.events) ? [...current.events, event].slice(-250) : [event];
  next.updatedAt = now;

  if (!next.stats || typeof next.stats !== "object") {
    next.stats = defaultProgress().stats;
  }

  if (event.type === "challenge_started") {
    next.stats.challengesStarted = Number(next.stats.challengesStarted || 0) + 1;
    next.activeChallenge = event.payload?.challenge || null;
  } else if (event.type === "challenge_completed") {
    next.stats.challengesCompleted = Number(next.stats.challengesCompleted || 0) + 1;
    if (event.payload?.result === "win") {
      next.stats.wins = Number(next.stats.wins || 0) + 1;
    }
    next.activeChallenge = null;
  }

  store[userId] = next;
  writeStore(store);
  return next;
}

module.exports = {
  appendEvent,
  getProgressForUser,
  getGamificationStateForUser,
  setGamificationStateForUser,
  getGamificationStandings,
};
