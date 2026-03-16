const STORAGE_KEY = "floppystack64.gamification.v1";
const PROFILE_DIRECTORY_KEY = "floppystack64.profile-directory.v1";
const REMOTE_SYNC_DELAY_MS = 350;
const DEFAULT_THREE_IN_SIXTY_MINUTES_PER_TARGET = 20;
const MIN_THREE_IN_SIXTY_MINUTES_PER_TARGET = 1;
const MAX_THREE_IN_SIXTY_MINUTES_PER_TARGET = 120;

const defaultState = {
  activeChallenge: null,
  recentSelections: [],
  playSessions: [],
  badges: [],
  preferences: {
    defaultMode: "random",
    threeInSixtyMinutesPerTarget: DEFAULT_THREE_IN_SIXTY_MINUTES_PER_TARGET,
  },
  stats: {
    totalPlayed: 0,
    totalWins: 0,
  },
};

function resolveProfileId(profileId) {
  const value = String(profileId || "guest").trim();
  return value || "guest";
}

function profileStorageKey(profileId) {
  return `${STORAGE_KEY}.${resolveProfileId(profileId)}`;
}

function readProfileDirectory() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROFILE_DIRECTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProfileDirectory(nextMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_DIRECTORY_KEY, JSON.stringify(nextMap || {}));
}

function resolveCanonicalProfileId(profileId) {
  const id = resolveProfileId(profileId);
  if (id === "guest") return "guest";
  const directory = readProfileDirectory();
  const mapped = directory?.[id]?.canonicalId;
  return resolveProfileId(mapped || id);
}

function readState(profileId = "guest") {
  if (typeof window === "undefined") return { ...defaultState };
  try {
    const key = profileStorageKey(profileId);
    let raw = window.localStorage.getItem(key);
    // Backward compatibility: migrate legacy unsuffixed guest state.
    if (!raw && resolveProfileId(profileId) === "guest") {
      raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) window.localStorage.setItem(key, raw);
    }
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      recentSelections: Array.isArray(parsed?.recentSelections) ? parsed.recentSelections : [],
      playSessions: Array.isArray(parsed?.playSessions) ? parsed.playSessions : [],
      badges: Array.isArray(parsed?.badges) ? parsed.badges : [],
      preferences: { ...defaultState.preferences, ...(parsed?.preferences || {}) },
      stats: { ...defaultState.stats, ...(parsed?.stats || {}) },
    };
  } catch {
    return { ...defaultState };
  }
}

function writeState(nextState, profileId = "guest") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(profileStorageKey(profileId), JSON.stringify(nextState));
  scheduleRemoteSync(profileId, nextState);
}

function clampThreeInSixtyMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_THREE_IN_SIXTY_MINUTES_PER_TARGET;
  return Math.min(
    MAX_THREE_IN_SIXTY_MINUTES_PER_TARGET,
    Math.max(MIN_THREE_IN_SIXTY_MINUTES_PER_TARGET, Math.floor(parsed))
  );
}

function getThreeInSixtyPerTargetMs(options, state) {
  const fromOptions = options?.threeInSixtyMinutesPerTarget;
  const fromPrefs = state?.preferences?.threeInSixtyMinutesPerTarget;
  const minutes = clampThreeInSixtyMinutes(fromOptions ?? fromPrefs);
  return minutes * 60 * 1000;
}

function buildCandidates(disks) {
  const list = [];
  (Array.isArray(disks) ? disks : []).forEach((disk) => {
    ["sideA", "sideB"].forEach((sideKey) => {
      const games = Array.isArray(disk?.[sideKey]) ? disk[sideKey] : [];
      games.forEach((game, gameIndex) => {
        const gameName = game && typeof game === "object" ? game.gameName : String(game || "");
        if (!String(gameName || "").trim()) return;
        list.push({
          diskId: disk?._id,
          datasetKey: disk?.datasetKey || "default",
          side: sideKey,
          sideLabel: sideKey === "sideA" ? "Side A" : "Side B",
          gameIndex,
          gameName: String(gameName).trim(),
        });
      });
    });
  });
  return list;
}

function makeSelectionKey(candidate) {
  return `${candidate.datasetKey}|${candidate.diskId}|${candidate.side}|${candidate.gameIndex}|${candidate.gameName}`;
}

function buildPlayedSet(sessions) {
  const set = new Set();
  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const target = session?.target;
    if (!target) return;
    set.add(
      makeSelectionKey({
        datasetKey: target.datasetKey || "default",
        diskId: target.diskId,
        side: target.side,
        gameIndex: Number(target.gameIndex || 0),
        gameName: target.gameName,
      })
    );
  });
  return set;
}

export const PLAY_MODES = [
  { id: "random", label: "Quick Play" },
  { id: "unplayed", label: "Unplayed Hunt" },
  { id: "three-in-60", label: "3 in 60" },
];

export function getGamificationPreferences(profileId = "guest") {
  return readState(profileId)?.preferences || { ...defaultState.preferences };
}

export function setDefaultPlayMode(mode, profileId = "guest") {
  const nextMode = PLAY_MODES.some((m) => m.id === mode) ? mode : "random";
  const state = readState(profileId);
  writeState(
    {
      ...state,
      preferences: {
        ...state.preferences,
        defaultMode: nextMode,
      },
    },
    profileId
  );
  return nextMode;
}

export function getThreeInSixtyMinutesPerTarget(profileId = "guest") {
  const prefs = getGamificationPreferences(profileId);
  return clampThreeInSixtyMinutes(prefs?.threeInSixtyMinutesPerTarget);
}

export function setThreeInSixtyMinutesPerTarget(minutes, profileId = "guest") {
  const nextMinutes = clampThreeInSixtyMinutes(minutes);
  const state = readState(profileId);
  writeState(
    {
      ...state,
      preferences: {
        ...state.preferences,
        threeInSixtyMinutesPerTarget: nextMinutes,
      },
    },
    profileId
  );
  return nextMinutes;
}

export function generatePlayChallenge(disks, options = {}) {
  const mode = String(options?.mode || "random");
  const profileId = options?.profileId || "guest";
  const state = readState(profileId);
  const candidates = buildCandidates(disks);
  if (!candidates.length) return null;

  const avoidRecent = Number(options?.avoidRecentCount ?? 8);
  const recentSet = new Set(state.recentSelections.slice(0, Math.max(0, avoidRecent)));
  const preferred = candidates.filter((candidate) => !recentSet.has(makeSelectionKey(candidate)));
  let pool = preferred.length ? preferred : candidates;

  if (mode === "unplayed") {
    const playedSet = buildPlayedSet(state.playSessions);
    const unplayedPool = pool.filter((candidate) => !playedSet.has(makeSelectionKey(candidate)));
    if (unplayedPool.length) pool = unplayedPool;
  }

  let challenge;
  let nextRecent = state.recentSelections.slice();

  if (mode === "three-in-60") {
    const perTargetMs = getThreeInSixtyPerTargetMs(options, state);
    const targetCount = Math.min(3, pool.length);
    const mutable = pool.slice();
    const targets = [];
    while (targets.length < targetCount && mutable.length) {
      const index = Math.floor(Math.random() * mutable.length);
      const pick = mutable.splice(index, 1)[0];
      targets.push(pick);
    }
    const now = Date.now();
    challenge = {
      id: `challenge-${now}`,
      type: mode,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + perTargetMs).toISOString(),
      status: "active",
      targets,
      totalTargets: targets.length,
      currentIndex: 0,
      completedCount: 0,
      target: targets[0] || null,
    };
    nextRecent = [...targets.map((t) => makeSelectionKey(t)), ...state.recentSelections].slice(0, 30);
  } else {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    challenge = {
      id: `challenge-${Date.now()}`,
      type: mode,
      createdAt: new Date().toISOString(),
      target: pick,
      status: "active",
    };
    nextRecent = [makeSelectionKey(pick), ...state.recentSelections].slice(0, 30);
  }

  writeState(
    {
      ...state,
      activeChallenge: challenge,
      recentSelections: nextRecent,
    },
    profileId
  );

  return challenge;
}

export function advanceActiveChallenge(options = {}) {
  const profileId = options?.profileId || "guest";
  const state = readState(profileId);
  const challenge = state?.activeChallenge;
  if (!challenge) return { challenge: null, completed: false, expired: false };

  if (challenge.type !== "three-in-60") {
    return { challenge, completed: false, expired: false };
  }

  const now = Date.now();

  const targets = Array.isArray(challenge.targets) ? challenge.targets : [];
  const perTargetMs = getThreeInSixtyPerTargetMs(options, state);
  const currentIndex = Number(challenge.currentIndex || 0);
  const nextIndex = currentIndex + 1;
  const completedCount = Math.min(Number(challenge.completedCount || 0) + 1, targets.length);

  if (nextIndex >= targets.length) {
    const completedChallenge = {
      ...challenge,
      status: "completed",
      completedAt: new Date(now).toISOString(),
      completedCount,
      currentIndex: targets.length,
      target: null,
    };
    writeState({ ...state, activeChallenge: null }, profileId);
    return { challenge: null, completed: true, expired: false, previous: completedChallenge };
  }

  const nextChallenge = {
    ...challenge,
    currentIndex: nextIndex,
    completedCount,
    target: targets[nextIndex],
    expiresAt: new Date(now + perTargetMs).toISOString(),
  };
  writeState({ ...state, activeChallenge: nextChallenge }, profileId);
  return { challenge: nextChallenge, completed: false, expired: false };
}

export function generateRandomPlayChallenge(disks, options = {}) {
  return generatePlayChallenge(disks, { ...options, mode: "random" });
}

export function getActiveChallenge(profileId = "guest") {
  return readState(profileId).activeChallenge || null;
}

export function clearActiveChallenge(profileId = "guest") {
  const state = readState(profileId);
  writeState({ ...state, activeChallenge: null }, profileId);
}

// Scaffolding hooks for future gamification:
// - start/finish sessions
// - win tracking
// - badge unlock checks
export function startPlaySession(target, options = {}) {
  const profileId = options?.profileId || "guest";
  const state = readState(profileId);
  const session = {
    id: `session-${Date.now()}`,
    target,
    startedAt: new Date().toISOString(),
    endedAt: null,
    result: "played",
  };
  writeState({
    ...state,
    playSessions: [session, ...state.playSessions].slice(0, 200),
    stats: {
      ...state.stats,
      totalPlayed: Number(state.stats?.totalPlayed || 0) + 1,
    },
  }, profileId);
  return session;
}

export function finishPlaySession(sessionId, result = "played", options = {}) {
  const profileId = options?.profileId || "guest";
  const state = readState(profileId);
  let wonIncrement = 0;
  const nextSessions = state.playSessions.map((session) => {
    if (session.id !== sessionId) return session;
    const nextResult = result === "won" ? "won" : result === "lost" ? "lost" : "played";
    if (nextResult === "won" && session.result !== "won") wonIncrement += 1;
    return {
      ...session,
      result: nextResult,
      endedAt: new Date().toISOString(),
    };
  });
  writeState({
    ...state,
    playSessions: nextSessions,
    stats: {
      ...state.stats,
      totalWins: Number(state.stats?.totalWins || 0) + wonIncrement,
    },
  }, profileId);
}

export function getGamificationSnapshot(profileId = "guest") {
  return readState(profileId);
}

export function getTargetSessionStats(target, profileId = "guest") {
  if (!target) return { playedCount: 0, winCount: 0, lastPlayedAt: null };
  const state = readState(profileId);
  const sessions = Array.isArray(state.playSessions) ? state.playSessions : [];
  const targetKey = makeSelectionKey({
    datasetKey: target.datasetKey || "default",
    diskId: target.diskId,
    side: target.side,
    gameIndex: Number(target.gameIndex || 0),
    gameName: target.gameName,
  });

  const matching = sessions.filter((session) => {
    const sessionTarget = session?.target;
    if (!sessionTarget) return false;
    return (
      makeSelectionKey({
        datasetKey: sessionTarget.datasetKey || "default",
        diskId: sessionTarget.diskId,
        side: sessionTarget.side,
        gameIndex: Number(sessionTarget.gameIndex || 0),
        gameName: sessionTarget.gameName,
      }) === targetKey
    );
  });

  return {
    playedCount: matching.length,
    winCount: matching.filter((session) => session?.result === "won").length,
    lastPlayedAt: matching[0]?.startedAt || null,
  };
}

export function getRecentPlaySessions(profileId = "guest", limit = 20) {
  const state = readState(profileId);
  const sessions = Array.isArray(state?.playSessions) ? state.playSessions : [];
  return sessions.slice(0, Math.max(0, Number(limit || 0)));
}

export function getLocalStandings(limit = 25) {
  if (typeof window === "undefined") return [];
  const aggregate = new Map();
  const prefix = `${STORAGE_KEY}.`;

  const directory = readProfileDirectory();
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const profileIdRaw = key.slice(prefix.length) || "guest";
    const profileId = resolveCanonicalProfileId(profileIdRaw);
    const state = readState(profileIdRaw);
    const totalPlayed = Number(state?.stats?.totalPlayed || 0);
    const totalWins = Number(state?.stats?.totalWins || 0);
    const existing = aggregate.get(profileId) || {
      profileId,
      displayName:
        directory?.[profileId]?.displayName ||
        directory?.[profileId]?.username ||
        directory?.[profileIdRaw]?.displayName ||
        directory?.[profileIdRaw]?.username ||
        profileId,
      totalPlayed: 0,
      totalWins: 0,
    };
    existing.totalPlayed += totalPlayed;
    existing.totalWins += totalWins;
    aggregate.set(profileId, existing);
  }

  const entries = Array.from(aggregate.values()).map((entry) => ({
    ...entry,
    winRate: entry.totalPlayed > 0 ? entry.totalWins / entry.totalPlayed : 0,
  }));

  return entries
    .sort((a, b) => {
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalPlayed - a.totalPlayed;
    })
    .slice(0, Math.max(1, Number(limit || 0)));
}

export function upsertProfileIdentity(user) {
  if (typeof window === "undefined") return;
  const username = resolveProfileId(user?.username);
  const userId = resolveProfileId(user?.id);
  const canonicalId = username !== "guest" ? username : userId;
  if (!canonicalId || canonicalId === "guest") return;
  const current = readProfileDirectory();
  const common = {
    canonicalId,
    username: user?.username || current?.[canonicalId]?.username || canonicalId,
    displayName: user?.displayName || user?.username || current?.[canonicalId]?.displayName || canonicalId,
    updatedAt: new Date().toISOString(),
  };
  current[canonicalId] = {
    profileId: canonicalId,
    ...common,
  };
  if (userId && userId !== "guest") {
    current[userId] = {
      profileId: userId,
      ...common,
    };
  }
  if (username && username !== "guest") {
    current[username] = {
      profileId: username,
      ...common,
    };
  }
  writeProfileDirectory(current);
}

const pendingRemoteStates = new Map();
const pendingRemoteTimers = new Map();

function getAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("floppystack.auth.token") || "";
}

function canSyncRemote(profileId) {
  return resolveProfileId(profileId) !== "guest" && Boolean(getAuthToken());
}

function scheduleRemoteSync(profileId, nextState) {
  if (!canSyncRemote(profileId)) return;
  const key = resolveProfileId(profileId);
  pendingRemoteStates.set(key, nextState);

  const existingTimer = pendingRemoteTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    pendingRemoteTimers.delete(key);
    const payload = pendingRemoteStates.get(key);
    if (!payload) return;
    pendingRemoteStates.delete(key);
    try {
      await fetch("/api/player/me/gamification", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ state: payload }),
      });
    } catch {
      // Keep local state as source of truth if network/server is unavailable.
    }
  }, REMOTE_SYNC_DELAY_MS);

  pendingRemoteTimers.set(key, timer);
}

export async function hydrateGamificationFromServer(profileId = "guest") {
  if (!canSyncRemote(profileId)) return readState(profileId);
  try {
    const response = await fetch("/api/player/me/gamification", {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const state = sanitizeIncomingState(payload?.state);
    writeState(state, profileId);
    return state;
  } catch {
    return readState(profileId);
  }
}

function sanitizeIncomingState(input) {
  const parsed = input && typeof input === "object" ? input : {};
  return {
    ...defaultState,
    ...parsed,
    recentSelections: Array.isArray(parsed?.recentSelections) ? parsed.recentSelections : [],
    playSessions: Array.isArray(parsed?.playSessions) ? parsed.playSessions : [],
    badges: Array.isArray(parsed?.badges) ? parsed.badges : [],
    preferences: { ...defaultState.preferences, ...(parsed?.preferences || {}) },
    stats: { ...defaultState.stats, ...(parsed?.stats || {}) },
  };
}

export async function getRemoteStandings(limit = 25) {
  if (!getAuthToken()) return getLocalStandings(limit);
  try {
    const response = await fetch(`/api/player/standings?limit=${encodeURIComponent(String(limit || 25))}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload?.standings) ? payload.standings : [];
    return rows.map((row) => ({
      profileId: row?.user?.username || row?.userId || "unknown",
      displayName: row?.user?.displayName || row?.user?.username || "Unknown User",
      callsign: row?.user?.callsign || row?.user?.username || "UNK",
      totalPlayed: Number(row?.totalPlayed || 0),
      totalWins: Number(row?.totalWins || 0),
      winRate: Number(row?.winRate || 0),
      userId: row?.userId || row?.user?.id || "",
    }));
  } catch {
    return getLocalStandings(limit);
  }
}
