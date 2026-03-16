import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  PLAY_MODES,
  getGamificationPreferences,
  getRecentPlaySessions,
  getGamificationSnapshot,
  getRemoteStandings,
  setDefaultPlayMode,
  getTargetSessionStats,
} from "../../services/gamificationService";
import badgeGoldDisk from "../../assets/badges/badge-gold-disk.png";
import badgeSilverPad from "../../assets/badges/badge-silver-pad.png";
import badgeBronzeChip from "../../assets/badges/badge-bronze-chip.png";
import badgeElite from "../../assets/badges/badge-elite.png";
import badgePro from "../../assets/badges/badge-pro.png";
import badgeRookie from "../../assets/badges/badge-rookie.png";
import "./NowPlayingPage.css";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

function pickBestRecord(records, gameName) {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return null;
  const wanted = normalizeName(gameName);
  return (
    list.find((record) => normalizeName(record?.gameName) === wanted) ||
    list.find((record) => normalizeName(record?.canonicalTitle) === wanted) ||
    list[0]
  );
}

function formatWhen(value) {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function formatRemainingParts(ms) {
  const safe = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function isGuidLike(value) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

function getStandingTitle(entry, index) {
  if (index === 0) return "Arcade Commander";
  if (index === 1) return "Joystick Ace";
  if (index === 2) return "Pixel Raider";
  if (entry.totalWins >= 50) return "High-Score Hunter";
  if (entry.winRate >= 0.7) return "Turbo Champion";
  if (entry.winRate >= 0.5) return "Cartridge Captain";
  if (entry.winRate >= 0.3) return "Disk Runner";
  return "Ready Player";
}

function getStandingBadge(entry, index) {
  if (index === 0) return { label: "GOLD DISK", tone: "gold" };
  if (index === 1) return { label: "SILVER PAD", tone: "silver" };
  if (index === 2) return { label: "BRONZE CHIP", tone: "bronze" };
  if (entry.totalWins >= 25) return { label: "ELITE", tone: "elite" };
  if (entry.totalWins >= 10) return { label: "PRO", tone: "pro" };
  return { label: "ROOKIE", tone: "rookie" };
}

const RANK_LEGEND = [
  "Arcade Commander (#1)",
  "Joystick Ace (#2)",
  "Pixel Raider (#3)",
  "High-Score Hunter (50+ wins)",
  "Turbo Champion (70%+ win rate)",
  "Cartridge Captain (50%+ win rate)",
  "Disk Runner (30%+ win rate)",
  "Ready Player (everyone else)",
];

const BADGE_LEGEND = [
  { tone: "gold", label: "GOLD DISK", description: "#1 in standings" },
  { tone: "silver", label: "SILVER PAD", description: "#2 in standings" },
  { tone: "bronze", label: "BRONZE CHIP", description: "#3 in standings" },
  { tone: "elite", label: "ELITE", description: "25+ wins" },
  { tone: "pro", label: "PRO", description: "10+ wins" },
  { tone: "rookie", label: "ROOKIE", description: "Getting started" },
];

function getBadgeImage(tone) {
  if (tone === "gold") return badgeGoldDisk;
  if (tone === "silver") return badgeSilverPad;
  if (tone === "bronze") return badgeBronzeChip;
  if (tone === "elite") return badgeElite;
  if (tone === "pro") return badgePro;
  return badgeRookie;
}

function playTone(frequency, durationMs, type = "square", volume = 0.03) {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + durationMs / 1000);
  osc.onended = () => {
    try {
      ctx.close();
    } catch (_err) {
      // no-op
    }
  };
}

export default function NowPlayingPage({
  authUser,
  activeChallenge,
  playFocusToken,
  onRandomPlay,
  onEndChallenge,
  onAdvanceChallenge,
  onNavigateView,
}) {
  const target = activeChallenge?.target || null;
  const profileId = authUser?.username || authUser?.id || "guest";
  const friendlyName = isGuidLike(authUser?.username)
    ? authUser?.callsign || authUser?.displayName || "Player"
    : authUser?.callsign || authUser?.displayName || authUser?.username || "Guest";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("player");
  const [summary, setSummary] = useState(() => getGamificationSnapshot(profileId).stats || {});
  const [defaultMode, setDefaultMode] = useState(() => getGamificationPreferences(profileId).defaultMode || "random");
  const [selectedMode, setSelectedMode] = useState(() => getGamificationPreferences(profileId).defaultMode || "random");
  const [standings, setStandings] = useState([]);
  const standingsTimersRef = useRef([]);
  const lastFocusTokenRef = useRef(playFocusToken);
  const lastCountdownBeepSecondRef = useRef(-1);
  const timeUpAlarmPlayedRef = useRef(false);

  const targetStats = useMemo(() => getTargetSessionStats(target, profileId), [target, profileId]);
  const recentSessions = useMemo(() => getRecentPlaySessions(profileId, 8), [profileId, summary?.totalPlayed, summary?.totalWins]);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const isThreeInSixty = activeChallenge?.type === "three-in-60";
  const totalTargets = Number(activeChallenge?.totalTargets || (Array.isArray(activeChallenge?.targets) ? activeChallenge.targets.length : 0) || 0);
  const completedCount = Number(activeChallenge?.completedCount || 0);
  const expiresAtTs = Date.parse(activeChallenge?.expiresAt || "");
  const remainingMs = Number.isFinite(expiresAtTs) ? Math.max(0, expiresAtTs - nowTs) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    const stats = getGamificationSnapshot(profileId).stats || {};
    setSummary(stats);
    const prefs = getGamificationPreferences(profileId);
    const mode = prefs?.defaultMode || "random";
    setDefaultMode(mode);
    setSelectedMode(mode);
  }, [profileId, target?.gameName, target?.diskId, target?.side, target?.gameIndex]);

  const clearStandingsTimers = useCallback(() => {
    standingsTimersRef.current.forEach((id) => window.clearTimeout(id));
    standingsTimersRef.current = [];
  }, []);

  const refreshStandings = useCallback(async () => {
    const rows = await getRemoteStandings(20);
    setStandings(Array.isArray(rows) ? rows : []);
  }, []);

  const refreshStandingsWithFollowups = useCallback(async () => {
    clearStandingsTimers();
    await refreshStandings();
    // Backend sync is debounced; follow-up pulls ensure UI catches fresh standings.
    const t1 = window.setTimeout(() => {
      refreshStandings();
    }, 500);
    const t2 = window.setTimeout(() => {
      refreshStandings();
    }, 1400);
    standingsTimersRef.current.push(t1, t2);
  }, [clearStandingsTimers, refreshStandings]);

  const playTimeUpAlarm = useCallback(() => {
    playTone(220, 180, "sawtooth", 0.05);
    window.setTimeout(() => playTone(196, 220, "sawtooth", 0.05), 180);
    window.setTimeout(() => playTone(164, 280, "sawtooth", 0.06), 420);
  }, []);

  useEffect(() => {
    refreshStandingsWithFollowups();
    return () => {
      clearStandingsTimers();
    };
  }, [profileId, summary?.totalPlayed, summary?.totalWins, refreshStandingsWithFollowups, clearStandingsTimers]);

  useEffect(() => {
    let cancelled = false;
    async function loadMetadata() {
      if (!target?.gameName) {
        setMetadata(null);
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/metadata/records?q=${encodeURIComponent(target.gameName)}&limit=25`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (cancelled) return;
        setMetadata(pickBestRecord(payload?.records, target.gameName));
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Failed to load game metadata");
        setMetadata(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [target?.gameName]);

  useEffect(() => {
    if (playFocusToken == null) return;
    if (lastFocusTokenRef.current == null) {
      lastFocusTokenRef.current = playFocusToken;
      return;
    }
    if (playFocusToken !== lastFocusTokenRef.current) {
      setActiveSection("overview");
      lastFocusTokenRef.current = playFocusToken;
    }
  }, [playFocusToken]);

  useEffect(() => {
    if (!isThreeInSixty) return undefined;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isThreeInSixty]);

  useEffect(() => {
    lastCountdownBeepSecondRef.current = -1;
    timeUpAlarmPlayedRef.current = false;
  }, [activeChallenge?.id, activeChallenge?.currentIndex, isThreeInSixty]);

  useEffect(() => {
    if (!isThreeInSixty || !target) return;

    if (remainingSeconds > 0 && remainingSeconds <= 10) {
      if (lastCountdownBeepSecondRef.current !== remainingSeconds) {
        lastCountdownBeepSecondRef.current = remainingSeconds;
        playTone(880, 90, "square", 0.04);
      }
    }

    if (remainingSeconds <= 0 && !timeUpAlarmPlayedRef.current) {
      timeUpAlarmPlayedRef.current = true;
      playTimeUpAlarm();
    }
  }, [isThreeInSixty, remainingSeconds, target, playTimeUpAlarm]);

  const art = metadata?.images?.boxFront || metadata?.images?.screenshot || "";
  const canonicalTitle = metadata?.canonicalTitle || target?.gameName || "Unknown Game";
  const description = metadata?.description || "No description available yet.";
  const collapsedDescription =
    descriptionExpanded || description.length <= 260
      ? description
      : `${description.slice(0, 260).trimEnd()}...`;
  const remainingParts = formatRemainingParts(remainingMs);
  const isLastTenSeconds = remainingSeconds > 0 && remainingSeconds <= 10;

  const handleSetDefaultMode = () => {
    const next = setDefaultPlayMode(selectedMode, profileId);
    setDefaultMode(next);
  };

  const startSelectedMode = async () => {
    setActiveSection("overview");
    await onRandomPlay?.(null, { mode: selectedMode });
    refreshStandingsWithFollowups();
  };

  const startDefaultMode = async () => {
    setActiveSection("overview");
    await onRandomPlay?.(null, { mode: defaultMode });
    refreshStandingsWithFollowups();
  };

  const hasActiveRun = Boolean(activeChallenge?.target);
  const leaderWins = Number(standings?.[0]?.totalWins || 0);
  const togglePlayRun = async () => {
    if (hasActiveRun) {
      onEndChallenge?.();
      refreshStandingsWithFollowups();
      return;
    }
    await startDefaultMode();
  };

  const onAdvanceAndRefresh = async (result) => {
    await onAdvanceChallenge?.(result);
    refreshStandingsWithFollowups();
  };

  return (
    <section className="np-root">
      <div className="np-card">
        <div className="np-header">
          <h2 className="np-title">Play Dashboard</h2>
          <button
            type="button"
            onClick={togglePlayRun}
            className={`mobile-play-toggle np-play-toggle-btn ${hasActiveRun ? "is-stop" : ""}`}
            title={hasActiveRun ? "Stop active run" : "Start default mode"}
            aria-label={hasActiveRun ? "Stop active run" : "Start default mode"}
          >
            <span className="navbar-toggler-icon" />
            <span className="mobile-play-btn-label">{hasActiveRun ? "Stop" : "Play!"}</span>
            <span className="mobile-play-sonar" aria-hidden="true" />
          </button>
        </div>

        <div className="np-sections" role="tablist" aria-label="Play dashboard sections">
          <button type="button" className={`np-chip ${activeSection === "player" ? "is-active" : ""}`} onClick={() => setActiveSection("player")}>Stats</button>
          <button type="button" className={`np-chip ${activeSection === "overview" ? "is-active" : ""}`} onClick={() => setActiveSection("overview")}>Playing</button>
          <button type="button" className={`np-chip ${activeSection === "mode" ? "is-active" : ""}`} onClick={() => setActiveSection("mode")}>Mode</button>
          <button type="button" className={`np-chip ${activeSection === "game" ? "is-active" : ""}`} onClick={() => setActiveSection("game")}>Game Stats</button>
          <button type="button" className={`np-chip ${activeSection === "history" ? "is-active" : ""}`} onClick={() => setActiveSection("history")}>History</button>
          <button type="button" className={`np-chip ${activeSection === "standings" ? "is-active" : ""}`} onClick={() => setActiveSection("standings")}>Standings</button>
          <button type="button" className={`np-chip ${activeSection === "ranks" ? "is-active" : ""}`} onClick={() => setActiveSection("ranks")}>Ranks</button>
          <button type="button" className={`np-chip ${activeSection === "badges" ? "is-active" : ""}`} onClick={() => setActiveSection("badges")}>Badges</button>
        </div>

        {activeSection === "mode" ? (
          <div className="np-mode-panel">
            <div className="np-mode-title">Default Play Mode</div>
            <div className="np-mode-controls">
              <select
                className="np-select"
                value={selectedMode}
                onChange={(event) => setSelectedMode(event.target.value)}
              >
                {PLAY_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <button type="button" className="np-btn" onClick={handleSetDefaultMode}>
                Set Default
              </button>
              <button type="button" className="np-btn np-btn-muted" onClick={startSelectedMode}>
                Play Selected
              </button>
            </div>
            <div className="np-mode-note">
              Current default: <b>{PLAY_MODES.find((m) => m.id === defaultMode)?.label || "Quick Play"}</b>
            </div>
          </div>
        ) : null}

        {activeSection === "overview" ? (
          !target ? (
            <div className="np-empty">No active challenge. Tap <b>Play Default</b> to start.</div>
          ) : (
            <>
              <div className="np-layout np-layout-playing">
                <div className={`np-art-wrap np-art-wrap-playing ${art ? "has-art" : "no-art"}`}>
                  {art ? (
                    <img src={art} alt={`${canonicalTitle} box art`} className="np-art" loading="lazy" />
                  ) : (
                    <div className="np-art-empty">No Box Art</div>
                  )}

                  <div className={`np-play-overlay ${art ? "is-translucent" : "is-solid"}`}>
                    <h3 className="np-game np-game-overlay">{canonicalTitle}</h3>
                    <div className="np-meta np-meta-overlay">
                      Disk <b>{target.diskId}</b> | <b>{target.side === "sideA" ? "Side A" : "Side B"}</b>
                    </div>
                    <div className="np-meta np-meta-overlay">
                      Challenge: <b>{PLAY_MODES.find((m) => m.id === activeChallenge?.type)?.label || "Quick Play"}</b>
                    </div>
                    {isThreeInSixty ? (
                      <div className="np-challenge-hero">
                        <span>Progress: <b>{Math.min(completedCount + 1, totalTargets)}/{totalTargets}</b></span>
                        <span>
                          Time Left:{" "}
                          <b className={`np-timer ${isLastTenSeconds ? "is-critical" : ""}`}>
                            <span>{remainingParts.minutes}</span>
                            <span>:</span>
                            <span className={isLastTenSeconds ? "np-timer-seconds-critical" : ""}>{remainingParts.seconds}</span>
                          </b>
                        </span>
                      </div>
                    ) : null}
                    <div className="np-actions np-actions-hero">
                      <button type="button" className="np-btn np-btn-hero" onClick={() => onAdvanceAndRefresh("won")}>
                        WIN
                      </button>
                      <button type="button" className="np-btn np-btn-hero" onClick={() => onAdvanceAndRefresh("lost")}>
                        LOSE
                      </button>
                      <button type="button" className="np-btn np-btn-muted np-btn-hero" onClick={() => onAdvanceAndRefresh("played")}>
                        SKIP
                      </button>
                    </div>
                  </div>
                </div>

                <div className="np-info np-info-playing">
                  <div className="np-description">
                    <div className="np-description-title">Description</div>
                    <p>{collapsedDescription}</p>
                    {description.length > 260 ? (
                      <button
                        type="button"
                        className="np-link-btn"
                        onClick={() => setDescriptionExpanded((prev) => !prev)}
                      >
                        {descriptionExpanded ? "Collapse" : "Expand"}
                      </button>
                    ) : null}
                  </div>
                  {loading ? <div className="np-note">Loading metadata...</div> : null}
                  {error ? <div className="np-error">{error}</div> : null}
                </div>
              </div>
            </>
          )
        ) : null}

        {activeSection === "game" ? (
          !target ? (
            <div className="np-empty">No current game to show stats for.</div>
          ) : (
            <div className="np-stats-grid">
              <div className="np-stat">
                <span>Played (this game)</span>
                <b>{targetStats.playedCount}</b>
              </div>
              <div className="np-stat">
                <span>Wins (this game)</span>
                <b>{targetStats.winCount}</b>
              </div>
              <div className="np-stat">
                <span>Total Played</span>
                <b>{Number(summary?.totalPlayed || 0)}</b>
              </div>
              <div className="np-stat">
                <span>Total Wins</span>
                <b>{Number(summary?.totalWins || 0)}</b>
              </div>
              <div className="np-stat np-stat-wide">
                <span>Last Played</span>
                <b>{formatWhen(targetStats.lastPlayedAt)}</b>
              </div>
            </div>
          )
        ) : null}

        {activeSection === "player" ? (
          <div className="np-stats-grid">
            <div className="np-stat">
              <span>Total Played</span>
              <b>{Number(summary?.totalPlayed || 0)}</b>
            </div>
            <div className="np-stat">
              <span>Total Wins</span>
              <b>{Number(summary?.totalWins || 0)}</b>
            </div>
            <div className="np-stat">
              <span>Win Rate</span>
              <b>
                {Number(summary?.totalPlayed || 0) > 0
                  ? `${Math.round((Number(summary?.totalWins || 0) / Number(summary?.totalPlayed || 1)) * 100)}%`
                  : "0%"}
              </b>
            </div>
            <div className="np-stat">
              <span>Profile</span>
              <b>{friendlyName}</b>
            </div>
          </div>
        ) : null}

        {activeSection === "history" ? (
          <div className="np-history-list">
            {recentSessions.length ? (
              recentSessions.map((session) => (
                <div className="np-history-item" key={session.id}>
                  <div className="np-history-name">{session?.target?.gameName || "Unknown Game"}</div>
                  <div className="np-history-meta">
                    Disk {session?.target?.diskId} | {session?.target?.side === "sideA" ? "Side A" : "Side B"} |{" "}
                    {formatWhen(session?.startedAt)}
                  </div>
                </div>
              ))
            ) : (
              <div className="np-empty">No play history for this profile yet.</div>
            )}
          </div>
        ) : null}

        {activeSection === "standings" ? (
          <div className="np-history-list np-arcade-leaderboard">
            <div className="np-note np-standings-note">-- BEST 8 --</div>
            {standings.length ? (
              standings.map((entry, index) => {
                const isCurrent = String(entry.profileId) === String(profileId);
                const title = getStandingTitle(entry, index);
                const badge = getStandingBadge(entry, index);
                const powerScore = Math.round(
                  Number(entry.totalWins || 0) * 3 + Number(entry.totalPlayed || 0) + Number(entry.winRate || 0) * 100
                );
                const alias = String(entry.callsign || entry.displayName || entry.profileId || "UNK").toUpperCase();
                const realName = String(entry.displayName || entry.profileId || "Unknown Player");
                const meterPct = leaderWins > 0 ? Math.max(8, Math.round((Number(entry.totalWins || 0) / leaderWins) * 100)) : 8;
                return (
                  <div
                    className={`np-history-item np-standing-item ${isCurrent ? "is-current" : ""} ${
                      index === 0 ? "is-leader" : ""
                    }`}
                    key={entry.profileId}
                  >
                    <div className={`np-standing-badge-corner is-${badge.tone}`}>
                      <img src={getBadgeImage(badge.tone)} alt="" />
                      <span className="np-standing-rank-overlay">{index + 1}</span>
                    </div>
                    <div className="np-standing-row">
                      <div className="np-standing-callsign-row">
                        <div className="np-standing-callsign">{alias}{isCurrent ? " (YOU)" : ""}</div>
                      </div>
                      <div className="np-standing-realname">{realName}</div>
                      <div className="np-standing-head np-standing-head-arcade">
                        <span className={`np-rank-badge is-${badge.tone}`}>{badge.label}</span>
                      </div>
                      <div className="np-standing-title">{title}</div>
                      <div className="np-standing-meter" aria-hidden="true">
                        <span style={{ width: `${meterPct}%` }} />
                      </div>
                      <div className="np-history-meta">
                        Wins: {entry.totalWins} | Played: {entry.totalPlayed} | Win Rate:{" "}
                        {entry.totalPlayed > 0 ? `${Math.round(entry.winRate * 100)}%` : "0%"} | Power: {powerScore}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="np-empty">No standings data yet.</div>
            )}
          </div>
        ) : null}

        {activeSection === "ranks" ? (
          <div className="np-history-list">
            <div className="np-note np-standings-note">Rank Titles</div>
            <div className="np-legend-group">
              <div className="np-legend-chips">
                {RANK_LEGEND.map((item) => (
                  <span key={item} className="np-legend-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "badges" ? (
          <div className="np-history-list">
            <div className="np-note np-standings-note">Badge Guide</div>
            <div className="np-legend-group">
              <div className="np-legend-chips">
                {BADGE_LEGEND.map((item) => (
                  <span key={item.label} className="np-legend-chip np-legend-chip-badge">
                    <span className={`np-rank-badge-icon is-${item.tone}`} aria-hidden="true">
                      <img src={getBadgeImage(item.tone)} alt="" />
                    </span>
                    <span>{item.label}</span>
                    <span className="np-legend-chip-desc">{item.description}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

NowPlayingPage.propTypes = {
  authUser: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    displayName: PropTypes.string,
    callsign: PropTypes.string,
  }),
  activeChallenge: PropTypes.shape({
    id: PropTypes.string,
    target: PropTypes.shape({
      gameName: PropTypes.string,
      diskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      side: PropTypes.string,
      gameIndex: PropTypes.number,
      datasetKey: PropTypes.string,
    }),
  }),
  playFocusToken: PropTypes.number,
  onRandomPlay: PropTypes.func,
  onEndChallenge: PropTypes.func,
  onAdvanceChallenge: PropTypes.func,
  onNavigateView: PropTypes.func,
};
