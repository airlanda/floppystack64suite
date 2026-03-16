import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  advancePlayChallenge,
  endPlayChallenge,
  fetchMetadataRecord,
  fetchPlayStandings,
  fetchPlayState,
  Fs64GamificationState,
  Fs64MetadataProvider,
  Fs64MetadataRecord,
  Fs64PlayMode,
  Fs64PlaySession,
  Fs64StandingRow,
  getDefaultPlayMode,
  getRecentPlaySessions,
  getTargetSessionStats,
  getThreeInSixtyMinutesPerTarget,
  lookupMetadataRecord,
  PLAY_MODES,
  setDefaultPlayMode,
  setThreeInSixtyMinutesPerTarget,
  startPlayChallenge,
} from '@fs64/domain';
import { Fs64ThemeName, getFs64Theme, readStoredFs64Theme, resolveFs64ThemeName } from '@fs64/theme';
import './play.css';

const BADGE_BY_INDEX = [
  { label: 'GOLD DISK', tone: 'gold' },
  { label: 'SILVER PAD', tone: 'silver' },
  { label: 'BRONZE CHIP', tone: 'bronze' },
];

const RANK_LADDER = [
  { id: 'boot', label: 'Boot Loader', winsRequired: 0, note: 'Start logging sessions and build your first streak.' },
  { id: 'cadet', label: 'Arcade Cadet', winsRequired: 3, note: 'Three wins gets you onto the board.' },
  { id: 'pilot', label: 'Disk Pilot', winsRequired: 8, note: 'You are clearing enough targets to matter.' },
  { id: 'ace', label: 'Side B Ace', winsRequired: 15, note: 'Consistent wins across the collection.' },
  { id: 'captain', label: 'Drive Captain', winsRequired: 25, note: 'Serious run volume with reliable closes.' },
  { id: 'legend', label: 'Floppy Legend', winsRequired: 40, note: 'This is the late-game ladder.' },
];

function getBadge(index: number) {
  return BADGE_BY_INDEX[index] || { label: 'ARCADE ACE', tone: 'elite' };
}

function formatWhen(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function formatModeLabel(mode?: string | null) {
  if (mode === 'three-in-60') return '3 in 60';
  if (mode === 'unplayed') return 'Unplayed Hunt';
  return 'Quick Play';
}

function formatRemainingParts(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function collapseDescription(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return 'No description available yet.';
  return text.length > 220 ? `${text.slice(0, 220).trimEnd()}...` : text;
}

export function App() {
  const [themeName, setThemeName] = useState<Fs64ThemeName>(() => readStoredFs64Theme());
  const theme = getFs64Theme(themeName);
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'playing' | 'mode' | 'game' | 'standings' | 'stats' | 'ranks' | 'history'>('playing');
  const [standings, setStandings] = useState<Fs64StandingRow[]>([]);
  const [playState, setPlayState] = useState<Fs64GamificationState>({ stats: {}, playSessions: [], preferences: {}, activeChallenge: null });
  const [selectedMode, setSelectedMode] = useState<Fs64PlayMode>('random');
  const [minutesPerTarget, setMinutesPerTarget] = useState<number>(() => getThreeInSixtyMinutesPerTarget());
  const [activeMetadata, setActiveMetadata] = useState<Fs64MetadataRecord | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [lookupProvider, setLookupProvider] = useState<Fs64MetadataProvider>('thegamesdb');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    function syncTheme(event?: Event) {
      const nextTheme =
        event && 'detail' in event ? resolveFs64ThemeName((event as CustomEvent).detail) : readStoredFs64Theme();
      setThemeName(nextTheme);
    }

    window.addEventListener('fs64-theme-change', syncTheme as EventListener);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('fs64-theme-change', syncTheme as EventListener);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  async function refreshDashboard() {
    const [rows, state] = await Promise.all([fetchPlayStandings(8), fetchPlayState()]);
    setStandings(rows);
    setPlayState(state);
    setSelectedMode(getDefaultPlayMode(state));
    setMinutesPerTarget(getThreeInSixtyMinutesPerTarget());
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [rows, state] = await Promise.all([fetchPlayStandings(8), fetchPlayState()]);
        if (!cancelled) {
          setStandings(rows);
          setPlayState(state);
          setSelectedMode(getDefaultPlayMode(state));
          setMinutesPerTarget(getThreeInSixtyMinutesPerTarget());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load play dashboard');
          setStandings([]);
          setPlayState({ stats: {}, playSessions: [], preferences: {}, activeChallenge: null });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = playState?.stats || {};
  const totalWins = Number(stats.totalWins || 0);
  const totalPlayed = Number(stats.totalPlayed || 0);
  const recentSessions = useMemo(() => getRecentPlaySessions(undefined, 8) as Fs64PlaySession[], [playState]);
  const challenge = playState?.activeChallenge || null;
  const target = challenge?.target || null;
  const defaultMode = getDefaultPlayMode(playState);
  const targetStats = useMemo(() => getTargetSessionStats(target), [target, playState]);
  const isThreeInSixty = challenge?.type === 'three-in-60';
  const totalTargets = Number(challenge?.totalTargets || (Array.isArray(challenge?.targets) ? challenge.targets.length : 0) || 0);
  const completedCount = Number(challenge?.completedCount || 0);
  const expiresAtTs = Date.parse(challenge?.expiresAt || '');
  const remainingMs = Number.isFinite(expiresAtTs) ? Math.max(0, expiresAtTs - nowTs) : 0;
  const remainingDisplay = formatRemainingParts(remainingMs);
  const winRate = targetStats.playedCount > 0 ? Math.round((targetStats.winCount / targetStats.playedCount) * 100) : 0;
  const overallWinRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0;
  const art = activeMetadata?.images?.boxFront || activeMetadata?.images?.screenshot || activeMetadata?.images?.logo || '';
  const canonicalTitle = activeMetadata?.canonicalTitle || target?.gameName || 'Unknown Game';
  const description = collapseDescription(activeMetadata?.description);
  const currentRankIndex = Math.max(0, RANK_LADDER.reduce((best, rank, index) => (totalWins >= rank.winsRequired ? index : best), 0));
  const currentRank = RANK_LADDER[currentRankIndex];
  const nextRank = RANK_LADDER[currentRankIndex + 1] || null;
  const winsToNextRank = nextRank ? Math.max(0, nextRank.winsRequired - totalWins) : 0;
  const providerLabel = lookupProvider === 'thegamesdb' ? 'TheGamesDB' : 'Hybrid';

  useEffect(() => {
    if (!isThreeInSixty) return undefined;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isThreeInSixty, challenge?.id, challenge?.currentIndex]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      if (!target?.gameName) {
        setActiveMetadata(null);
        setMetadataLoading(false);
        setMetadataError(null);
        return;
      }

      setMetadataLoading(true);
      setMetadataError(null);
      try {
        const record = await fetchMetadataRecord(target.gameName);
        if (!cancelled) setActiveMetadata(record);
      } catch (loadError) {
        if (!cancelled) {
          setActiveMetadata(null);
          setMetadataError(loadError instanceof Error ? loadError.message : 'Failed to load metadata');
        }
      } finally {
        if (!cancelled) setMetadataLoading(false);
      }
    }

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [target?.gameName]);

  async function requestMetadataLookup() {
    if (!target?.gameName || lookupLoading) return;
    setLookupLoading(true);
    setMetadataError(null);
    try {
      const nextRecord = await lookupMetadataRecord({
        gameName: target.gameName,
        provider: lookupProvider,
        persist: true,
        downloadImages: true,
      });
      setActiveMetadata(nextRecord);
    } catch (lookupError) {
      setMetadataError(lookupError instanceof Error ? lookupError.message : 'Metadata lookup failed');
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleStart(mode?: Fs64PlayMode) {
    setActionLoading(true);
    setError(null);
    try {
      const next = await startPlayChallenge(mode || defaultMode);
      setPlayState(next);
      setActiveSection('playing');
      await refreshDashboard();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start play mode');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    setActionLoading(true);
    setError(null);
    try {
      const next = endPlayChallenge();
      setPlayState(next);
      await refreshDashboard();
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Failed to stop challenge');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdvance(result: 'won' | 'lost' | 'played') {
    setActionLoading(true);
    setError(null);
    try {
      const next = advancePlayChallenge(result);
      setPlayState(next);
      await refreshDashboard();
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : 'Failed to advance challenge');
    } finally {
      setActionLoading(false);
    }
  }

  function handleSaveModePreferences() {
    setActionLoading(true);
    setError(null);
    try {
      const nextMode = setDefaultPlayMode(selectedMode);
      const nextMinutes = setThreeInSixtyMinutesPerTarget(minutesPerTarget);
      setSelectedMode(nextMode);
      setMinutesPerTarget(nextMinutes);
      setPlayState((current) => ({
        ...current,
        preferences: {
          ...(current.preferences || {}),
          defaultMode: nextMode,
          threeInSixtyMinutesPerTarget: nextMinutes,
        },
      }));
    } catch (preferenceError) {
      setError(preferenceError instanceof Error ? preferenceError.message : 'Failed to save play preferences');
    } finally {
      setActionLoading(false);
    }
  }

  function jumpToDisk() {
    if (!target?.diskId) return;
    navigate(`/disks?diskId=${encodeURIComponent(String(target.diskId))}`);
  }

  function jumpToGames() {
    if (!target?.gameName) return;
    navigate(`/games?q=${encodeURIComponent(target.gameName)}`);
  }

  const cssVars = useMemo(
    () =>
      ({
        ['--fs64-background' as string]: theme.background,
        ['--fs64-panel' as string]: theme.panel,
        ['--fs64-panel-alt' as string]: theme.panelAlt,
        ['--fs64-border' as string]: theme.border,
        ['--fs64-text' as string]: theme.text,
        ['--fs64-muted' as string]: theme.muted,
        ['--fs64-accent' as string]: theme.accent,
      }) as React.CSSProperties,
    [theme]
  );

  return (
    <section className="fs64-play-root" style={cssVars}>
      <div className="fs64-play-hero">
        <div className="fs64-play-kicker">Now Playing</div>
        <h2 className="fs64-play-title">Play Dashboard</h2>
        <p className="fs64-play-subtitle">Standings, mode controls, game stats, recent history, and an active challenge panel using the legacy gamification model.</p>
      </div>

      <div className="fs64-play-controls">
        <button type="button" className={`fs64-play-main-btn${target ? ' is-stop' : ''}`} onClick={target ? handleStop : () => handleStart()} disabled={actionLoading}>
          {actionLoading ? 'Working...' : target ? 'Stop' : 'Play!'}
        </button>
        <div className="fs64-play-mode-note">Default mode: <b>{formatModeLabel(defaultMode)}</b></div>
      </div>

      <div className="fs64-play-chips" role="tablist" aria-label="Play sections">
        <button type="button" className={`fs64-play-chip${activeSection === 'playing' ? ' is-active' : ''}`} onClick={() => setActiveSection('playing')}>Playing</button>
        <button type="button" className={`fs64-play-chip${activeSection === 'mode' ? ' is-active' : ''}`} onClick={() => setActiveSection('mode')}>Mode</button>
        <button type="button" className={`fs64-play-chip${activeSection === 'game' ? ' is-active' : ''}`} onClick={() => setActiveSection('game')}>Game Stats</button>
        <button type="button" className={`fs64-play-chip${activeSection === 'standings' ? ' is-active' : ''}`} onClick={() => setActiveSection('standings')}>Standings</button>
        <button type="button" className={`fs64-play-chip${activeSection === 'stats' ? ' is-active' : ''}`} onClick={() => setActiveSection('stats')}>Stats</button>
        <button type="button" className={`fs64-play-chip${activeSection === 'ranks' ? ' is-active' : ''}`} onClick={() => setActiveSection('ranks')}>Ranks</button>
        <button type="button" className={`fs64-play-chip${activeSection === 'history' ? ' is-active' : ''}`} onClick={() => setActiveSection('history')}>History</button>
      </div>

      {loading ? <div className="fs64-play-message">Loading play dashboard...</div> : null}
      {error ? <div className="fs64-play-message is-error">{error}</div> : null}
      {metadataError ? <div className="fs64-play-message is-error">{metadataError}</div> : null}

      {!loading && !error && activeSection === 'playing' ? (
        target ? (
          <div className="fs64-now-playing-card">
            <div className="fs64-meta-toolbar">
              <div className="fs64-meta-provider-row" role="group" aria-label="Metadata provider">
                <span className="fs64-meta-provider-label">Provider</span>
                <div className="fs64-meta-provider-toggle">
                  <button
                    type="button"
                    className={`fs64-meta-provider-chip${lookupProvider === 'thegamesdb' ? ' is-active' : ''}`}
                    onClick={() => setLookupProvider('thegamesdb')}
                    aria-pressed={lookupProvider === 'thegamesdb'}
                  >
                    TheGamesDB
                  </button>
                  <button
                    type="button"
                    className={`fs64-meta-provider-chip${lookupProvider === 'hybrid' ? ' is-active' : ''}`}
                    onClick={() => setLookupProvider('hybrid')}
                    aria-pressed={lookupProvider === 'hybrid'}
                  >
                    Hybrid
                  </button>
                </div>
              </div>
              <button type="button" className="fs64-meta-refresh-btn" onClick={requestMetadataLookup} disabled={lookupLoading || !target?.gameName}>
                {lookupLoading ? 'Refreshing...' : `Refresh ${providerLabel}`}
              </button>
            </div>
            <div className="fs64-now-playing-layout">
              <div className="fs64-now-playing-main">
                <div className="fs64-now-playing-header">
                  <div>
                    <div className="fs64-now-playing-title">{canonicalTitle}</div>
                    <div className="fs64-now-playing-meta">Disk {target.diskId} | {target.sideLabel}</div>
                    {activeMetadata?.year || activeMetadata?.genre ? (
                      <div className="fs64-now-playing-meta">{activeMetadata?.year || 'Year ?'} | {activeMetadata?.genre || 'Genre ?'}</div>
                    ) : null}
                  </div>
                  <div className={`fs64-challenge-badge${isThreeInSixty ? ' is-timed' : ''}`}>{formatModeLabel(challenge?.type)}</div>
                </div>
                {isThreeInSixty ? (
                  <div className="fs64-now-playing-timer-wrap">
                    <div className={`fs64-now-playing-timer${remainingMs <= 10000 ? ' is-warning' : ''}`}>{remainingDisplay}</div>
                    <div className="fs64-now-playing-progress">Progress {Math.min(completedCount + 1, totalTargets)}/{totalTargets}</div>
                  </div>
                ) : null}
                <div className="fs64-now-playing-description">{metadataLoading ? 'Loading game data...' : description}</div>
                <div className="fs64-now-playing-stats">
                  <div className="fs64-mini-stat"><span>Played</span><b>{targetStats.playedCount}</b></div>
                  <div className="fs64-mini-stat"><span>Wins</span><b>{targetStats.winCount}</b></div>
                  <div className="fs64-mini-stat"><span>Win Rate</span><b>{winRate}%</b></div>
                  <div className="fs64-mini-stat"><span>Last Played</span><b>{formatWhen(targetStats.lastPlayedAt)}</b></div>
                </div>
                <div className="fs64-now-playing-actions">
                  <button type="button" className="fs64-action-btn" onClick={() => handleAdvance('won')} disabled={actionLoading}>WIN</button>
                  <button type="button" className="fs64-action-btn" onClick={() => handleAdvance('lost')} disabled={actionLoading}>LOSE</button>
                  <button type="button" className="fs64-action-btn is-muted" onClick={() => handleAdvance('played')} disabled={actionLoading}>SKIP</button>
                </div>
                <div className="fs64-target-nav-actions">
                  <button type="button" className="fs64-action-btn is-muted" onClick={jumpToDisk}>Go To Disk</button>
                  <button type="button" className="fs64-action-btn is-muted" onClick={jumpToGames}>Open In Games</button>
                </div>
              </div>
              <div className="fs64-now-playing-art-panel">
                {art ? <img className="fs64-now-playing-art" src={art} alt={canonicalTitle} /> : <div className="fs64-now-playing-art-fallback">NO ART</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="fs64-play-message">No active challenge. Press <b>Play!</b> to start the default mode.</div>
        )
      ) : null}

      {!loading && !error && activeSection === 'mode' ? (
        <div className="fs64-play-mode-panel">
          <div className="fs64-play-mode-grid">
            {PLAY_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`fs64-mode-card${selectedMode === mode.id ? ' is-active' : ''}`}
                onClick={() => setSelectedMode(mode.id)}
              >
                <span className="fs64-mode-card-label">{mode.label}</span>
                <span className="fs64-mode-card-meta">{mode.id === defaultMode ? 'Default' : 'Select'}</span>
              </button>
            ))}
          </div>
          <div className="fs64-mode-settings">
            <label className="fs64-mode-field">
              <span>Minutes Per Target</span>
              <input
                type="number"
                min={1}
                max={120}
                value={minutesPerTarget}
                onChange={(event) => setMinutesPerTarget(Number(event.target.value || 20))}
              />
            </label>
            <div className="fs64-mode-actions">
              <button type="button" className="fs64-action-btn" onClick={handleSaveModePreferences} disabled={actionLoading}>Save Default</button>
              <button type="button" className="fs64-action-btn is-muted" onClick={() => handleStart(selectedMode)} disabled={actionLoading}>Start Selected</button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && activeSection === 'game' ? (
        target ? (
          <div className="fs64-play-game-panel">
            <div className="fs64-meta-toolbar">
              <div className="fs64-meta-provider-row" role="group" aria-label="Metadata provider">
                <span className="fs64-meta-provider-label">Provider</span>
                <div className="fs64-meta-provider-toggle">
                  <button
                    type="button"
                    className={`fs64-meta-provider-chip${lookupProvider === 'thegamesdb' ? ' is-active' : ''}`}
                    onClick={() => setLookupProvider('thegamesdb')}
                    aria-pressed={lookupProvider === 'thegamesdb'}
                  >
                    TheGamesDB
                  </button>
                  <button
                    type="button"
                    className={`fs64-meta-provider-chip${lookupProvider === 'hybrid' ? ' is-active' : ''}`}
                    onClick={() => setLookupProvider('hybrid')}
                    aria-pressed={lookupProvider === 'hybrid'}
                  >
                    Hybrid
                  </button>
                </div>
              </div>
              <button type="button" className="fs64-meta-refresh-btn" onClick={requestMetadataLookup} disabled={lookupLoading || !target?.gameName}>
                {lookupLoading ? 'Refreshing...' : `Refresh ${providerLabel}`}
              </button>
            </div>
            <div className="fs64-play-game-header">
              <div>
                <div className="fs64-play-game-title">{canonicalTitle}</div>
                <div className="fs64-play-game-meta">Disk {target.diskId} | {target.sideLabel} | Slot {target.gameIndex + 1}</div>
                {activeMetadata?.developer || activeMetadata?.publisher ? (
                  <div className="fs64-play-game-meta">{activeMetadata?.developer || 'Unknown Dev'} | {activeMetadata?.publisher || 'Unknown Publisher'}</div>
                ) : null}
              </div>
              {art ? <img className="fs64-play-game-thumb" src={art} alt={canonicalTitle} /> : null}
            </div>
            <div className="fs64-play-game-description">{metadataLoading ? 'Loading game data...' : description}</div>
            <div className="fs64-play-stats-grid is-compact">
              <div className="fs64-play-stat-card">
                <span>Total Plays</span>
                <b>{targetStats.playedCount}</b>
              </div>
              <div className="fs64-play-stat-card">
                <span>Total Wins</span>
                <b>{targetStats.winCount}</b>
              </div>
              <div className="fs64-play-stat-card">
                <span>Win Rate</span>
                <b>{winRate}%</b>
              </div>
              <div className="fs64-play-stat-card">
                <span>Last Played</span>
                <b>{formatWhen(targetStats.lastPlayedAt)}</b>
              </div>
            </div>
            <div className="fs64-target-nav-actions">
              <button type="button" className="fs64-action-btn is-muted" onClick={jumpToDisk}>Go To Disk</button>
              <button type="button" className="fs64-action-btn is-muted" onClick={jumpToGames}>Open In Games</button>
            </div>
          </div>
        ) : (
          <div className="fs64-play-message">Start a challenge to see current game stats.</div>
        )
      ) : null}

      {!loading && !error && activeSection === 'standings' ? (
        standings.length ? (
          <div className="fs64-play-board">
            {standings.map((entry, index) => {
              const badge = getBadge(index);
              const callsign = String(entry.user?.callsign || entry.user?.displayName || entry.user?.username || 'UNK').toUpperCase();
              const name = String(entry.user?.displayName || entry.user?.username || 'Unknown User');
              const standingWinRate = Number(entry.winRate || 0);
              return (
                <article key={`${entry.userId}-${index}`} className={`fs64-standing-card is-${badge.tone}`}>
                  <div className="fs64-standing-rank">{index + 1}</div>
                  <div className="fs64-standing-callsign">{callsign}</div>
                  <div className="fs64-standing-name">{name}</div>
                  <div className="fs64-standing-badge">{badge.label}</div>
                  <div className="fs64-standing-stats">
                    <span>Wins {entry.totalWins}</span>
                    <span>Played {entry.totalPlayed}</span>
                    <span>Rate {(standingWinRate * 100).toFixed(0)}%</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="fs64-play-message">No standings data yet.</div>
        )
      ) : null}

      {!loading && !error && activeSection === 'stats' ? (
        <div className="fs64-play-stats-grid">
          <div className="fs64-play-stat-card">
            <span>Total Played</span>
            <b>{totalPlayed}</b>
          </div>
          <div className="fs64-play-stat-card">
            <span>Total Wins</span>
            <b>{totalWins}</b>
          </div>
          <div className="fs64-play-stat-card">
            <span>Win Rate</span>
            <b>{overallWinRate}%</b>
          </div>
          <div className="fs64-play-stat-card">
            <span>Recent Sessions</span>
            <b>{recentSessions.length}</b>
          </div>
        </div>
      ) : null}

      {!loading && !error && activeSection === 'ranks' ? (
        <div className="fs64-rank-section">
          <div className="fs64-rank-summary">
            <div className="fs64-rank-summary-card is-current">
              <span>Current Rank</span>
              <b>{currentRank.label}</b>
              <small>{currentRank.note}</small>
            </div>
            <div className="fs64-rank-summary-card">
              <span>Total Wins</span>
              <b>{totalWins}</b>
              <small>{overallWinRate}% overall win rate</small>
            </div>
            <div className="fs64-rank-summary-card">
              <span>Next Unlock</span>
              <b>{nextRank ? nextRank.label : 'Max Rank'}</b>
              <small>{nextRank ? `${winsToNextRank} wins to unlock` : 'All ranks unlocked'}</small>
            </div>
          </div>
          <div className="fs64-rank-grid">
            {RANK_LADDER.map((rank, index) => {
              const unlocked = totalWins >= rank.winsRequired;
              const isCurrent = index === currentRankIndex;
              return (
                <article key={rank.id} className={`fs64-rank-card${unlocked ? ' is-unlocked' : ''}${isCurrent ? ' is-current' : ''}`}>
                  <div className="fs64-rank-card-top">
                    <span className="fs64-rank-chip">{rank.winsRequired}+ wins</span>
                    <span className="fs64-rank-state">{isCurrent ? 'Current' : unlocked ? 'Unlocked' : 'Locked'}</span>
                  </div>
                  <div className="fs64-rank-title">{rank.label}</div>
                  <div className="fs64-rank-note">{rank.note}</div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && !error && activeSection === 'history' ? (
        recentSessions.length ? (
          <div className="fs64-play-history-list">
            {recentSessions.map((session) => {
              const sessionTarget = session?.target;
              const sideLabel = sessionTarget?.side === 'sideA' ? 'Side A' : sessionTarget?.side === 'sideB' ? 'Side B' : 'Unknown Side';
              return (
                <div key={session.id} className="fs64-play-history-item">
                  <div className="fs64-play-history-title">{sessionTarget?.gameName || 'Unknown Game'}</div>
                  <div className="fs64-play-history-meta">
                    Disk {sessionTarget?.diskId || '?'} | {sideLabel} | {formatWhen(session.startedAt)}
                  </div>
                  <div className="fs64-play-history-result">Result: {String(session.result || 'played').toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fs64-play-message">No play history yet.</div>
        )
      ) : null}
    </section>
  );
}

export default App;
