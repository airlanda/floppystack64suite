import './App.css';
import React, { Component }  from 'react';
import AppNavBarra from './components/AppNavBarra.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'
import { Container } from 'reactstrap';

import {Provider} from 'react-redux'
import DiskInventory from "./components/DiskInventory/DiskInventory.jsx";
import GameFinderPage from "./components/GameFinder/GameFinderPage.jsx";
import StoreSettingsPage from "./components/Settings/StoreSettingsPage.jsx";
import NowPlayingPage from "./components/NowPlaying/NowPlayingPage.jsx";
import AccountView from "./components/Auth/AccountView.jsx";
import * as authService from "./services/authService";
import {
  advanceActiveChallenge,
  clearActiveChallenge,
  finishPlaySession,
  generatePlayChallenge,
  getGamificationPreferences,
  getActiveChallenge,
  hydrateGamificationFromServer,
  startPlaySession,
  upsertProfileIdentity,
} from "./services/gamificationService";

import store from './store'

class App extends Component{
  state = {
    activeView:
      typeof window !== "undefined" && window.location.pathname === "/games"
        ? "games"
        : typeof window !== "undefined" && window.location.pathname === "/settings"
          ? "settings"
          : typeof window !== "undefined" && window.location.pathname === "/play"
            ? "play"
          : typeof window !== "undefined" && window.location.pathname === "/account"
            ? "account"
          : "disks",
    search: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") || "" : "",
    storeConfigVersion: 0,
    authUser: null,
    authLoading: true,
    authError: "",
    activeChallenge: null,
    activeSessionId: "",
    playFocusToken: 0,
  };

  getProfileId = (user = this.state.authUser) => {
    return user?.username || user?.id || "guest";
  };

  async componentDidMount() {
    try {
      const user = await authService.me();
      if (user) upsertProfileIdentity(user);
      await hydrateGamificationFromServer(this.getProfileId(user));
      const challenge = getActiveChallenge(this.getProfileId(user));
      this.setState({
        authUser: user || null,
        authError: "",
        activeChallenge: challenge || null,
      });
    } catch (_err) {
      authService.clearAuthToken();
      this.setState({ authUser: null, authError: "Session expired. Please sign in again." });
    } finally {
      this.setState({ authLoading: false });
    }
  }
  
  setGameSearch = (nextValue) => {
    const q = String(nextValue || "");
    this.setState({ search: q });
  };

  setViewMode = (nextView) => {
    const valid = new Set(["disks", "games", "settings", "play", "account"]);
    this.setState({
      activeView: valid.has(nextView) ? nextView : "disks",
    });
  };

  onStoresUpdated = () => {
    this.setState((prev) => ({
      storeConfigVersion: prev.storeConfigVersion + 1,
      activeView: "disks",
    }));
  };

  registerUser = async ({ username, password, displayName, callsign }) => {
    this.setState({ authLoading: true, authError: "" });
    try {
      const user = await authService.register({ username, password, displayName, callsign });
      if (user) upsertProfileIdentity(user);
      await hydrateGamificationFromServer(this.getProfileId(user));
      const challenge = getActiveChallenge(this.getProfileId(user));
      this.setState({ authUser: user || null, authError: "", activeChallenge: challenge || null });
      return { ok: true, user };
    } catch (err) {
      const message = err?.message || "Registration failed.";
      this.setState({ authError: message });
      return { ok: false, error: message };
    } finally {
      this.setState({ authLoading: false });
    }
  };

  loginUser = async ({ username, password }) => {
    this.setState({ authLoading: true, authError: "" });
    try {
      const user = await authService.login({ username, password });
      if (user) upsertProfileIdentity(user);
      await hydrateGamificationFromServer(this.getProfileId(user));
      const challenge = getActiveChallenge(this.getProfileId(user));
      this.setState({ authUser: user || null, authError: "", activeChallenge: challenge || null });
      return { ok: true, user };
    } catch (err) {
      const message = err?.message || "Login failed.";
      this.setState({ authError: message });
      return { ok: false, error: message };
    } finally {
      this.setState({ authLoading: false });
    }
  };

  logoutUser = async () => {
    this.setState({ authLoading: true, authError: "" });
    try {
      await authService.logout();
      const guestChallenge = getActiveChallenge("guest");
      this.setState({ authUser: null, authError: "", activeChallenge: guestChallenge || null });
    } catch (err) {
      this.setState({ authError: err?.message || "Logout failed." });
    } finally {
      this.setState({ authLoading: false });
    }
  };

  startRandomPlay = async (sourceDisks = null, options = {}) => {
    try {
      if (this.state.activeView !== "play") {
        this.setState({ activeView: "play" });
      }
      const profileId = this.getProfileId();
      const localDisks = Array.isArray(sourceDisks) && sourceDisks.length ? sourceDisks : null;
      let disks = localDisks;
      if (!disks) {
        const response = await fetch("/api/items/disks");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
        disks = Array.isArray(payload) ? payload : [];
      }

      const prefs = getGamificationPreferences(profileId);
      const mode = options?.mode || prefs?.defaultMode || "random";
      const challenge = generatePlayChallenge(disks, { avoidRecentCount: 8, profileId, mode });
      if (!challenge?.target) return { ok: false, error: "No games available for challenge." };

      const session = startPlaySession(challenge.target, { profileId });
      this.setState((prev) => ({
        activeChallenge: challenge,
        activeSessionId: session?.id || "",
        activeView: "play",
        playFocusToken: Number(prev.playFocusToken || 0) + 1,
      }));
      return { ok: true, challenge };
    } catch (error) {
      return { ok: false, error: error?.message || "Failed to start random play." };
    }
  };

  endRandomPlay = () => {
    clearActiveChallenge(this.getProfileId());
    this.setState({ activeChallenge: null, activeSessionId: "" });
  };

  advancePlayChallenge = (result = "played") => {
    const profileId = this.getProfileId();
    const activeChallenge = this.state.activeChallenge;
    if (!activeChallenge) return { ok: false, error: "No active challenge." };

    if (this.state.activeSessionId) {
      finishPlaySession(this.state.activeSessionId, result, { profileId });
    }

    if (activeChallenge.type !== "three-in-60") {
      clearActiveChallenge(profileId);
      this.setState({ activeChallenge: null, activeSessionId: "" });
      return { ok: true, done: true };
    }

    const next = advanceActiveChallenge({ profileId });
    if (next?.challenge?.target) {
      const session = startPlaySession(next.challenge.target, { profileId });
      this.setState({
        activeChallenge: next.challenge,
        activeSessionId: session?.id || "",
      });
      return { ok: true, done: false };
    }

    this.setState({ activeChallenge: null, activeSessionId: "" });
    return { ok: true, done: true, completed: Boolean(next?.completed), expired: Boolean(next?.expired) };
  };

  render() {
  const isGameView = this.state.activeView === "games";
  const isSettingsView = this.state.activeView === "settings";
  const isPlayView = this.state.activeView === "play";
  const isAccountView = this.state.activeView === "account";
  return (
    <Provider store={store}>
    <div className="App" style={{ fontFamily: '"commodore", Arial, sans-serif' }}>
      {this.state.authError ? (
        <div className="app-auth-error" role="status">{this.state.authError}</div>
      ) : null}
      <AppNavBarra
        viewMode={this.state.activeView}
        gameSearchValue={this.state.search}
        onGameSearchChange={this.setGameSearch}
        onViewModeChange={this.setViewMode}
        authUser={this.state.authUser}
        authLoading={this.state.authLoading}
        authError={this.state.authError}
        onRegister={this.registerUser}
        onLogin={this.loginUser}
        onLogout={this.logoutUser}
        hasActiveChallenge={Boolean(this.state.activeChallenge?.target)}
        onStartRandomPlay={this.startRandomPlay}
      />
      <Container className="app-main-container" style={{ paddingLeft: "0px", paddingRight: "0px", margin: "0 auto" }}>
        <div className={`app-view-panel ${isGameView || isSettingsView || isPlayView || isAccountView ? "is-hidden" : ""}`} aria-hidden={isGameView || isSettingsView || isPlayView || isAccountView}>
          <DiskInventory
            storeConfigVersion={this.state.storeConfigVersion}
            activeChallenge={this.state.activeChallenge}
            onStartRandomPlay={this.startRandomPlay}
          />
        </div>
        <div className={`app-view-panel ${isGameView ? "" : "is-hidden"}`} aria-hidden={!isGameView}>
          <GameFinderPage searchQuery={this.state.search} onStartRandomPlay={this.startRandomPlay} />
        </div>
        <div className={`app-view-panel ${isSettingsView ? "" : "is-hidden"}`} aria-hidden={!isSettingsView}>
          <StoreSettingsPage onStoresUpdated={this.onStoresUpdated} authProfileId={this.getProfileId()} />
        </div>
        <div className={`app-view-panel ${isPlayView ? "" : "is-hidden"}`} aria-hidden={!isPlayView}>
          <NowPlayingPage
            authUser={this.state.authUser}
            activeChallenge={this.state.activeChallenge}
            playFocusToken={this.state.playFocusToken}
            onRandomPlay={this.startRandomPlay}
            onEndChallenge={this.endRandomPlay}
            onAdvanceChallenge={this.advancePlayChallenge}
            onNavigateView={this.setViewMode}
          />
        </div>
        <div className={`app-view-panel ${isAccountView ? "" : "is-hidden"}`} aria-hidden={!isAccountView}>
          <AccountView
            authUser={this.state.authUser}
            authLoading={this.state.authLoading}
            authError={this.state.authError}
            onLogin={this.loginUser}
            onRegister={this.registerUser}
            onLogout={this.logoutUser}
          />
        </div>
      </Container>
    </div>
    </Provider>
  );
  }
}

export default App;
