import { getApiBaseUrl, fetchDisks } from './disks';

const AUTH_TOKEN_STORAGE_KEY = 'floppystack.auth.token';
const GAMIFICATION_STORAGE_KEY = 'floppystack64.gamification.v1';
const PROFILE_DIRECTORY_KEY = 'floppystack64.profile-directory.v1';
const DEFAULT_THREE_IN_SIXTY_MINUTES_PER_TARGET = 20;
const MIN_THREE_IN_SIXTY_MINUTES_PER_TARGET = 1;
const MAX_THREE_IN_SIXTY_MINUTES_PER_TARGET = 120;

export const PLAY_MODES = [
  { id: 'random', label: 'Quick Play' },
  { id: 'unplayed', label: 'Unplayed Hunt' },
  { id: 'three-in-60', label: '3 in 60' },
] as const;

export type Fs64PlayMode = (typeof PLAY_MODES)[number]['id'];

export type Fs64StandingRow = {
  userId: string;
  totalPlayed: number;
  totalWins: number;
  winRate: number;
  user?: {
    id?: string;
    username?: string;
    displayName?: string;
    callsign?: string;
  } | null;
};

export type Fs64PlayTarget = {
  diskId: string | number;
  datasetKey?: string;
  side: 'sideA' | 'sideB';
  sideLabel: string;
  gameIndex: number;
  gameName: string;
};

export type Fs64PlaySession = {
  id: string;
  startedAt?: string | null;
  endedAt?: string | null;
  result?: string | null;
  target?: Fs64PlayTarget | null;
};

export type Fs64PlayChallenge = {
  id: string;
  type: string;
  createdAt?: string;
  expiresAt?: string;
  status?: string;
  target?: Fs64PlayTarget | null;
  targets?: Fs64PlayTarget[];
  totalTargets?: number;
  currentIndex?: number;
  completedCount?: number;
};

export type Fs64TargetSessionStats = {
  playedCount: number;
  winCount: number;
  lastPlayedAt: string | null;
};

export type Fs64GamificationState = {
  stats?: {
    totalPlayed?: number;
    totalWins?: number;
    [key: string]: unknown;
  };
  preferences?: {
    defaultMode?: string;
    threeInSixtyMinutesPerTarget?: number;
    [key: string]: unknown;
  };
  recentSelections?: string[];
  playSessions?: Fs64PlaySession[];
  activeChallenge?: Fs64PlayChallenge | null;
  [key: string]: unknown;
};

function readJsonStorage(key: string) {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJsonStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function profileStorageKey(profileId: string) {
  return `${GAMIFICATION_STORAGE_KEY}.${profileId || 'guest'}`;
}

function clampThreeInSixtyMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_THREE_IN_SIXTY_MINUTES_PER_TARGET;
  return Math.min(MAX_THREE_IN_SIXTY_MINUTES_PER_TARGET, Math.max(MIN_THREE_IN_SIXTY_MINUTES_PER_TARGET, Math.floor(parsed)));
}

function getDefaultState(): Fs64GamificationState {
  return {
    activeChallenge: null,
    recentSelections: [],
    playSessions: [],
    preferences: {
      defaultMode: 'random',
      threeInSixtyMinutesPerTarget: DEFAULT_THREE_IN_SIXTY_MINUTES_PER_TARGET,
    },
    stats: {
      totalPlayed: 0,
      totalWins: 0,
    },
  };
}

function resolveCanonicalProfileId(profileId: string) {
  const id = String(profileId || 'guest').trim() || 'guest';
  if (id === 'guest') return 'guest';
  const directory = (readJsonStorage(PROFILE_DIRECTORY_KEY) || {}) as Record<string, { canonicalId?: string }>;
  return directory?.[id]?.canonicalId || id;
}

function getResolvedProfileId() {
  const token = getFs64AuthToken();
  if (!token) return 'guest';
  const directory = (readJsonStorage(PROFILE_DIRECTORY_KEY) || {}) as Record<string, { canonicalId?: string; username?: string; profileId?: string }>;
  const candidates = Object.values(directory);
  const first = Array.isArray(candidates) ? candidates[0] : null;
  return first?.canonicalId || first?.username || first?.profileId || 'guest';
}

function sanitizeGamificationState(input: unknown): Fs64GamificationState {
  const parsed = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const defaults = getDefaultState();
  return {
    ...defaults,
    ...parsed,
    stats: parsed.stats && typeof parsed.stats === 'object' ? { ...defaults.stats, ...(parsed.stats as Record<string, unknown>) } : defaults.stats,
    preferences:
      parsed.preferences && typeof parsed.preferences === 'object'
        ? { ...defaults.preferences, ...(parsed.preferences as Record<string, unknown>) }
        : defaults.preferences,
    recentSelections: Array.isArray(parsed.recentSelections) ? (parsed.recentSelections as string[]) : [],
    playSessions: Array.isArray(parsed.playSessions) ? (parsed.playSessions as Fs64PlaySession[]) : [],
    activeChallenge: parsed.activeChallenge && typeof parsed.activeChallenge === 'object' ? (parsed.activeChallenge as Fs64PlayChallenge) : null,
  };
}

export function getFs64AuthToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
}

export function makeFs64AuthHeaders(extra: Record<string, string> = {}) {
  const token = getFs64AuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function getLocalPlayState(profileId = getResolvedProfileId()): Fs64GamificationState {
  const canonical = resolveCanonicalProfileId(profileId);
  const raw = readJsonStorage(profileStorageKey(canonical)) || readJsonStorage(profileStorageKey(profileId)) || readJsonStorage(GAMIFICATION_STORAGE_KEY);
  return sanitizeGamificationState(raw);
}

function writeLocalPlayState(nextState: Fs64GamificationState, profileId = getResolvedProfileId()) {
  const canonical = resolveCanonicalProfileId(profileId);
  writeJsonStorage(profileStorageKey(canonical), nextState);
}

function makeSelectionKey(target: Pick<Fs64PlayTarget, 'datasetKey' | 'diskId' | 'side' | 'gameIndex' | 'gameName'>) {
  return `${target.datasetKey || 'default'}|${target.diskId}|${target.side}|${target.gameIndex}|${target.gameName}`;
}

function buildCandidates(disks: any[]): Fs64PlayTarget[] {
  const list: Fs64PlayTarget[] = [];
  (Array.isArray(disks) ? disks : []).forEach((disk) => {
    (['sideA', 'sideB'] as const).forEach((sideKey) => {
      const games = Array.isArray(disk?.[sideKey]) ? disk[sideKey] : [];
      games.forEach((game: any, gameIndex: number) => {
        const gameName = game && typeof game === 'object' ? game.gameName : String(game || '');
        if (!String(gameName || '').trim()) return;
        list.push({
          diskId: disk?._id,
          datasetKey: disk?.datasetKey || 'default',
          side: sideKey,
          sideLabel: sideKey === 'sideA' ? 'Side A' : 'Side B',
          gameIndex,
          gameName: String(gameName).trim(),
        });
      });
    });
  });
  return list;
}

function buildPlayedSet(sessions: Fs64PlaySession[] = []) {
  return new Set(
    sessions
      .map((session) => session?.target)
      .filter(Boolean)
      .map((target) => makeSelectionKey(target as Fs64PlayTarget))
  );
}

function buildLocalStandings(limit = 8): Fs64StandingRow[] {
  if (typeof window === 'undefined') return [];
  const directory = (readJsonStorage(PROFILE_DIRECTORY_KEY) || {}) as Record<string, { username?: string; displayName?: string; callsign?: string }>;
  const aggregate = new Map<string, Fs64StandingRow>();

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(`${GAMIFICATION_STORAGE_KEY}.`)) continue;
    const profileId = key.slice(`${GAMIFICATION_STORAGE_KEY}.`.length) || 'guest';
    const state = sanitizeGamificationState(readJsonStorage(key));
    const totalPlayed = Number(state?.stats?.totalPlayed || 0);
    const totalWins = Number(state?.stats?.totalWins || 0);
    const userMeta = directory?.[profileId] || {};
    aggregate.set(profileId, {
      userId: profileId,
      totalPlayed,
      totalWins,
      winRate: totalPlayed > 0 ? totalWins / totalPlayed : 0,
      user: {
        id: profileId,
        username: userMeta.username || profileId,
        displayName: userMeta.displayName || userMeta.username || profileId,
        callsign: userMeta.callsign || userMeta.username || 'UNK',
      },
    });
  }

  return Array.from(aggregate.values())
    .sort((a, b) => {
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalPlayed - a.totalPlayed;
    })
    .slice(0, Math.max(1, limit));
}

export function getGamificationPreferences(profileId = getResolvedProfileId()) {
  return getLocalPlayState(profileId)?.preferences || { ...getDefaultState().preferences };
}

export function setDefaultPlayMode(mode: string, profileId = getResolvedProfileId()): Fs64PlayMode {
  const nextMode = (PLAY_MODES.some((entry) => entry.id === mode) ? mode : 'random') as Fs64PlayMode;
  const state = getLocalPlayState(profileId);
  const nextState = sanitizeGamificationState({
    ...state,
    preferences: {
      ...(state.preferences || {}),
      defaultMode: nextMode,
    },
  });
  writeLocalPlayState(nextState, profileId);
  return nextMode;
}

export function getThreeInSixtyMinutesPerTarget(profileId = getResolvedProfileId()) {
  return clampThreeInSixtyMinutes(getGamificationPreferences(profileId)?.threeInSixtyMinutesPerTarget);
}

export function setThreeInSixtyMinutesPerTarget(minutes: number, profileId = getResolvedProfileId()) {
  const nextMinutes = clampThreeInSixtyMinutes(minutes);
  const state = getLocalPlayState(profileId);
  const nextState = sanitizeGamificationState({
    ...state,
    preferences: {
      ...(state.preferences || {}),
      threeInSixtyMinutesPerTarget: nextMinutes,
    },
  });
  writeLocalPlayState(nextState, profileId);
  return nextMinutes;
}

export async function fetchPlayStandings(limit = 8): Promise<Fs64StandingRow[]> {
  const token = getFs64AuthToken();
  if (!token) return buildLocalStandings(limit);

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/player/standings?limit=${encodeURIComponent(String(limit))}`, {
    headers: makeFs64AuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return buildLocalStandings(limit);
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error || `Failed to load standings: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return Array.isArray(payload?.standings) ? payload.standings : [];
}

export async function fetchPlayState(): Promise<Fs64GamificationState> {
  const token = getFs64AuthToken();
  if (!token) return getLocalPlayState();

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/player/me/gamification`, {
    headers: makeFs64AuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return getLocalPlayState();
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error || `Failed to load play state: ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return sanitizeGamificationState(payload?.state);
}

export function getDefaultPlayMode(state: Fs64GamificationState): Fs64PlayMode {
  const mode = String(state?.preferences?.defaultMode || 'random');
  return (PLAY_MODES.some((entry) => entry.id === mode) ? mode : 'random') as Fs64PlayMode;
}

export function getTargetSessionStats(target?: Fs64PlayTarget | null, profileId = getResolvedProfileId()): Fs64TargetSessionStats {
  if (!target) return { playedCount: 0, winCount: 0, lastPlayedAt: null };
  const state = getLocalPlayState(profileId);
  const sessions = Array.isArray(state.playSessions) ? state.playSessions : [];
  const targetKey = makeSelectionKey({
    datasetKey: target.datasetKey || 'default',
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
        datasetKey: sessionTarget.datasetKey || 'default',
        diskId: sessionTarget.diskId,
        side: sessionTarget.side,
        gameIndex: Number(sessionTarget.gameIndex || 0),
        gameName: sessionTarget.gameName,
      }) === targetKey
    );
  });

  return {
    playedCount: matching.length,
    winCount: matching.filter((session) => session?.result === 'won').length,
    lastPlayedAt: matching[0]?.startedAt || null,
  };
}

export function getRecentPlaySessions(profileId = getResolvedProfileId(), limit = 20) {
  const state = getLocalPlayState(profileId);
  const sessions = Array.isArray(state?.playSessions) ? state.playSessions : [];
  return sessions.slice(0, Math.max(0, Number(limit || 0)));
}

export async function startPlayChallenge(mode: string = 'random'): Promise<Fs64GamificationState> {
  const state = getLocalPlayState();
  const disks = await fetchDisks();
  const candidates = buildCandidates(disks);
  if (!candidates.length) {
    throw new Error('No games available for play.');
  }

  const preferred = candidates.filter((candidate) => !(state.recentSelections || []).includes(makeSelectionKey(candidate)));
  let pool = preferred.length ? preferred : candidates;

  if (mode === 'unplayed') {
    const playedSet = buildPlayedSet(state.playSessions || []);
    const unplayedPool = pool.filter((candidate) => !playedSet.has(makeSelectionKey(candidate)));
    if (unplayedPool.length) pool = unplayedPool;
  }

  let challenge: Fs64PlayChallenge;
  let nextRecent = [...(state.recentSelections || [])];
  if (mode === 'three-in-60') {
    const targetCount = Math.min(3, pool.length);
    const mutable = pool.slice();
    const targets: Fs64PlayTarget[] = [];
    while (targets.length < targetCount && mutable.length) {
      const index = Math.floor(Math.random() * mutable.length);
      targets.push(mutable.splice(index, 1)[0]);
    }
    const perTargetMs = clampThreeInSixtyMinutes(state?.preferences?.threeInSixtyMinutesPerTarget) * 60 * 1000;
    const now = Date.now();
    challenge = {
      id: `challenge-${now}`,
      type: 'three-in-60',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + perTargetMs).toISOString(),
      status: 'active',
      targets,
      totalTargets: targets.length,
      currentIndex: 0,
      completedCount: 0,
      target: targets[0] || null,
    };
    nextRecent = [...targets.map(makeSelectionKey), ...nextRecent].slice(0, 30);
  } else {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    challenge = {
      id: `challenge-${Date.now()}`,
      type: mode,
      createdAt: new Date().toISOString(),
      status: 'active',
      target: pick,
    };
    nextRecent = [makeSelectionKey(pick), ...nextRecent].slice(0, 30);
  }

  const target = challenge.target;
  const session: Fs64PlaySession | null = target
    ? {
        id: `session-${Date.now()}`,
        startedAt: new Date().toISOString(),
        endedAt: null,
        result: 'played',
        target,
      }
    : null;

  const nextState = sanitizeGamificationState({
    ...state,
    activeChallenge: challenge,
    recentSelections: nextRecent,
    playSessions: session ? [session, ...(state.playSessions || [])].slice(0, 200) : state.playSessions,
    stats: {
      ...(state.stats || {}),
      totalPlayed: Number(state?.stats?.totalPlayed || 0) + (session ? 1 : 0),
    },
  });

  writeLocalPlayState(nextState);
  return nextState;
}

export function endPlayChallenge(): Fs64GamificationState {
  const state = getLocalPlayState();
  const nextState = sanitizeGamificationState({
    ...state,
    activeChallenge: null,
  });
  writeLocalPlayState(nextState);
  return nextState;
}

export function advancePlayChallenge(result = 'played'): Fs64GamificationState {
  const state = getLocalPlayState();
  const challenge = state.activeChallenge;
  if (!challenge?.target) return state;

  const sessions = [...(state.playSessions || [])];
  if (sessions.length) {
    const current = sessions[0];
    if (current?.id && !current.endedAt) {
      sessions[0] = {
        ...current,
        endedAt: new Date().toISOString(),
        result: result === 'won' ? 'won' : result === 'lost' ? 'lost' : 'played',
      };
    }
  }

  const nextStats = {
    ...(state.stats || {}),
    totalWins: Number(state?.stats?.totalWins || 0) + (result === 'won' ? 1 : 0),
  };

  if (challenge.type !== 'three-in-60') {
    const nextState = sanitizeGamificationState({
      ...state,
      activeChallenge: null,
      playSessions: sessions,
      stats: nextStats,
    });
    writeLocalPlayState(nextState);
    return nextState;
  }

  const targets = Array.isArray(challenge.targets) ? challenge.targets : [];
  const nextIndex = Number(challenge.currentIndex || 0) + 1;
  const completedCount = Math.min(Number(challenge.completedCount || 0) + 1, targets.length);

  if (nextIndex >= targets.length) {
    const nextState = sanitizeGamificationState({
      ...state,
      activeChallenge: null,
      playSessions: sessions,
      stats: nextStats,
    });
    writeLocalPlayState(nextState);
    return nextState;
  }

  const nextTarget = targets[nextIndex];
  const perTargetMs = clampThreeInSixtyMinutes(state?.preferences?.threeInSixtyMinutesPerTarget) * 60 * 1000;
  const session: Fs64PlaySession = {
    id: `session-${Date.now()}`,
    startedAt: new Date().toISOString(),
    endedAt: null,
    result: 'played',
    target: nextTarget,
  };

  const nextState = sanitizeGamificationState({
    ...state,
    activeChallenge: {
      ...challenge,
      currentIndex: nextIndex,
      completedCount,
      expiresAt: new Date(Date.now() + perTargetMs).toISOString(),
      target: nextTarget,
    },
    playSessions: [session, ...sessions].slice(0, 200),
    stats: {
      ...nextStats,
      totalPlayed: Number(nextStats.totalPlayed || 0) + 1,
    },
  });

  writeLocalPlayState(nextState);
  return nextState;
}

