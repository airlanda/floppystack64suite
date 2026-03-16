import React, { Component } from 'react';
import {
  Collapse,
  Navbar,
  NavbarToggler,
  Input,
  Button
} from 'reactstrap';

import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/floppystack-navbar.css';
import Drive1541Icon from './DiskInventory/Drive1541Icon';


import { filterDisks, getItems } from '../actions/itemActions';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class AppNavBarra extends Component {

  state = {
    isOpen: false,
    gameFilter: "",
    showSuggestions: false,
    highlightedSuggestionIndex: -1,
    isMobile: false,
    randomizing: false,
  };

  componentDidMount() {
    this.updateViewportMode();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.updateViewportMode);
    }

    if (this.props.viewMode === "games") {
      this.setState({ gameFilter: this.props.gameSearchValue || "" });
    }
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.updateViewportMode);
    }
  }

  updateViewportMode = () => {
    if (typeof window === "undefined") return;
    const nextIsMobile = window.matchMedia("(max-width: 768px)").matches;
    if (nextIsMobile !== this.state.isMobile) {
      this.setState({ isMobile: nextIsMobile });
    }
  };

  componentDidUpdate(prevProps) {
    if (
      this.props.viewMode === "games" &&
      (prevProps.gameSearchValue !== this.props.gameSearchValue || prevProps.viewMode !== this.props.viewMode) &&
      this.props.gameSearchValue !== this.state.gameFilter
    ) {
      this.setState({ gameFilter: this.props.gameSearchValue || "" });
    }

    if (prevProps.viewMode !== this.props.viewMode) {
      this.setState({
        showSuggestions: false,
        highlightedSuggestionIndex: -1,
      });
    }
  }

  toggle = () => {
    this.setState({
      isOpen: !this.state.isOpen
    });
  };

  onRandomPlayClick = async () => {
    if (this.state.randomizing) return;

    if (!this.props.onStartRandomPlay) {
      this.switchView("disks");
      return;
    }

    this.setState({ randomizing: true });
    try {
      const result = await this.props.onStartRandomPlay();
      if (result?.ok) {
        this.switchView("play");
      }
    } finally {
      this.setState({ randomizing: false });
    }
  };

  getGameSuggestions = (query) => {
    const value = String(query || "").trim().toLowerCase();
    if (!value) return [];

    const source =
      this.props.itemReducerRef?.originalList ||
      this.props.itemReducerRef?.itemsArrayInsideState ||
      [];

    const seen = new Set();
    const names = [];

    source.forEach((disk) => {
      ["sideA", "sideB"].forEach((sideKey) => {
        const games = Array.isArray(disk?.[sideKey]) ? disk[sideKey] : [];

        games.forEach((game) => {
          const rawName = game && typeof game === "object" ? game.gameName : game;
          const gameName = typeof rawName === "string" ? rawName.trim() : "";
          if (!gameName) return;

          const dedupeKey = gameName.toLowerCase();
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          names.push(gameName);
        });
      });
    });

    const startsWith = [];
    const contains = [];

    names.forEach((name) => {
      const lower = name.toLowerCase();
      if (!lower.includes(value)) return;
      if (lower.startsWith(value)) startsWith.push(name);
      else contains.push(name);
    });

    return [...startsWith.sort(), ...contains.sort()].slice(0, 8);
  };

  switchView = (nextView) => {
    this.props.onViewModeChange?.(nextView);
    this.setState({ isOpen: false, showSuggestions: false, highlightedSuggestionIndex: -1 });
  };

  onFilterAdded = (e) => {
    const nextValue = e.target.value;
    const suggestions = this.getGameSuggestions(nextValue);

    this.setState({
      [e.target.name]: nextValue,
      showSuggestions: nextValue.trim().length > 0 && suggestions.length > 0,
      highlightedSuggestionIndex: suggestions.length > 0 ? 0 : -1
    });
  };

  onInputFocus = () => {
    const suggestions = this.getGameSuggestions(this.state.gameFilter);
    if (this.state.gameFilter.trim() && suggestions.length > 0) {
      this.setState({ showSuggestions: true });
    }
  };

  onInputBlur = () => {
    window.setTimeout(() => {
      this.setState({ showSuggestions: false, highlightedSuggestionIndex: -1 });
    }, 120);
  };

  onSelectSuggestion = (value) => {
    if (this.props.viewMode === "games") {
      this.setState(
        {
          gameFilter: value,
          showSuggestions: false,
          highlightedSuggestionIndex: -1,
          isOpen: false
        },
        () => this.onSubmitFilter()
      );
      return;
    }
    this.setState(
      {
        gameFilter: value,
        showSuggestions: false,
        highlightedSuggestionIndex: -1,
        isOpen: false
      },
      () => this.onSubmitFilter()
    );
  };

  onSearchKeyDown = (e) => {
    const suggestions = this.getGameSuggestions(this.state.gameFilter);

    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      this.setState((prev) => ({
        showSuggestions: true,
        highlightedSuggestionIndex:
          prev.highlightedSuggestionIndex >= suggestions.length - 1
            ? 0
            : prev.highlightedSuggestionIndex + 1
      }));
      return;
    }

    if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      this.setState((prev) => ({
        showSuggestions: true,
        highlightedSuggestionIndex:
          prev.highlightedSuggestionIndex <= 0
            ? suggestions.length - 1
            : prev.highlightedSuggestionIndex - 1
      }));
      return;
    }

    if (e.key === "Escape") {
      this.setState({ showSuggestions: false, highlightedSuggestionIndex: -1 });
      return;
    }

    if (e.key === "Enter") {
      if (
        this.state.showSuggestions &&
        this.state.highlightedSuggestionIndex >= 0 &&
        suggestions[this.state.highlightedSuggestionIndex]
      ) {
        e.preventDefault();
        this.onSelectSuggestion(suggestions[this.state.highlightedSuggestionIndex]);
        return;
      }

      this.onSubmitFilter();
    }
  };

  onSubmitFilter = () => {
    const value = this.state.gameFilter.trim();
    const isGameView = this.props.viewMode === "games";
    const isSettingsView = this.props.viewMode === "settings";
    const isPlayView = this.props.viewMode === "play";
    const isAccountView = this.props.viewMode === "account";

    if (isGameView) {
      this.props.onGameSearchChange?.(value);
      this.setState({
        isOpen: false,
        showSuggestions: false,
        highlightedSuggestionIndex: -1
      });
      return;
    }

    if (isSettingsView || isPlayView || isAccountView) {
      if (value === "") this.props.getItems();
      else this.props.filterDisks(value);
      this.props.onViewModeChange?.("disks");
      this.setState({
        isOpen: false,
        showSuggestions: false,
        highlightedSuggestionIndex: -1
      });
      return;
    }

    if (value === "") {
      this.props.getItems();
    } else {
      this.props.filterDisks(value);
    }

    this.setState({
      isOpen: false,
      showSuggestions: false,
      highlightedSuggestionIndex: -1
    });
  };

  onClearFilter = () => {
    const isGameView = this.props.viewMode === "games";
    const isSettingsView = this.props.viewMode === "settings";
    const isPlayView = this.props.viewMode === "play";
    const isAccountView = this.props.viewMode === "account";
    this.setState({
      gameFilter: "",
      showSuggestions: false,
      highlightedSuggestionIndex: -1
    });
    if (isGameView) {
      this.props.onGameSearchChange?.("");
    } else if (isSettingsView || isPlayView || isAccountView) {
      this.props.getItems();
      this.props.onViewModeChange?.("disks");
    } else {
      this.props.getItems();
    }
    this.setState({ isOpen: false });
  };

  render() {
    const viewMode = this.props.viewMode || "disks";
    const isGameView = viewMode === "games";
    const isSettingsView = viewMode === "settings";
    const isPlayView = viewMode === "play";
    const isAccountView = viewMode === "account";
    const showSearchControls = !this.state.isMobile || (!isSettingsView && !isPlayView && !isAccountView);
    const brandLabel = this.state.isMobile ? "FloppyStack" : "FloppyStack64";
    const suggestions = this.getGameSuggestions(this.state.gameFilter);
    const shouldShowSuggestions =
      this.state.showSuggestions && suggestions.length > 0 && this.state.gameFilter.trim().length > 0;
    const showSearchInTopPanel = showSearchControls && !this.state.isMobile;

    const mobileViewBar = (
      <div className="mobile-view-bottom-bar" role="tablist" aria-label="Mobile view switch">
        <Button
          color="dark"
          type="button"
          onClick={() => this.switchView("disks")}
          className={`mobile-view-btn ${viewMode === "disks" ? "is-active" : ""}`}
          aria-current={viewMode === "disks" ? "page" : undefined}
          title="Disk View"
        >
          <span className="mobile-view-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
              <rect x="2.5" y="1.5" width="11" height="13" className="icon-outline" />
              <rect x="4" y="3.5" width="8" height="2.5" className="icon-outline" />
              <line x1="4" y1="7.5" x2="12" y2="7.5" className="icon-outline" />
              <rect x="5" y="10" width="6" height="3" className="icon-outline" />
              <rect x="7" y="11" width="2" height="2" className="icon-fill" />
            </svg>
          </span>
          <span className="mobile-view-btn-label">Disks</span>
        </Button>
        <Button
          color="dark"
          type="button"
          onClick={() => this.switchView("games")}
          className={`mobile-view-btn ${isGameView ? "is-active" : ""}`}
          aria-current={isGameView ? "page" : undefined}
          title="Game View"
        >
          <span className="mobile-view-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" rx="1" ry="1" className="icon-outline" />
              <circle cx="3.5" cy="3.5" r="1.5" className="icon-accent-fill" />
              <circle cx="8" cy="8.5" r="4.1" className="icon-outline" />
              <circle cx="8" cy="8.5" r="2.6" className="icon-outline" />
              <circle cx="8" cy="8.5" r="1.1" className="icon-fill" />
            </svg>
          </span>
          <span className="mobile-view-btn-label">Games</span>
        </Button>
        <Button
          color="dark"
          type="button"
          onClick={() => this.switchView("play")}
          className={`mobile-view-btn ${isPlayView ? "is-active" : ""}`}
          aria-current={isPlayView ? "page" : undefined}
          title="Play Dashboard"
        >
          <span className="mobile-view-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" className="icon-outline" />
              <rect x="6" y="4" width="4" height="1.5" className="icon-fill" />
              <rect x="5" y="6.2" width="6" height="1.5" className="icon-fill" />
              <rect x="4" y="8.4" width="8" height="1.5" className="icon-fill" />
            </svg>
          </span>
          <span className="mobile-view-btn-label">Play</span>
        </Button>
        <Button
          color="dark"
          type="button"
          onClick={() => this.switchView("settings")}
          className={`mobile-view-btn ${isSettingsView ? "is-active" : ""}`}
          aria-current={isSettingsView ? "page" : undefined}
          title="Configuration View"
        >
          <span className="mobile-view-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
              <rect x="1.5" y="2.5" width="13" height="11" className="icon-outline" />
              <rect x="3" y="4" width="10" height="2" className="icon-outline" />
              <rect x="3" y="7" width="10" height="2" className="icon-outline" />
              <rect x="3" y="10" width="10" height="2" className="icon-outline" />
              <rect x="4" y="4" width="3" height="2" className="icon-fill" />
              <rect x="9" y="7" width="3" height="2" className="icon-fill" />
              <rect x="6" y="10" width="3" height="2" className="icon-fill" />
            </svg>
          </span>
          <span className="mobile-view-btn-label">Config</span>
        </Button>
        <Button
          color="dark"
          type="button"
          onClick={() => this.switchView("account")}
          className={`mobile-view-btn ${isAccountView ? "is-active" : ""}`}
          aria-current={isAccountView ? "page" : undefined}
          title="Profile View"
        >
          <span className="mobile-view-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
              <rect x="6" y="2" width="4" height="3" className="icon-outline" />
              <rect x="5" y="5" width="6" height="3" className="icon-outline" />
              <rect x="3.5" y="8.5" width="9" height="4" className="icon-outline" />
              <rect x="5" y="10" width="2" height="2" className="icon-fill" />
              <rect x="9" y="10" width="2" height="2" className="icon-fill" />
            </svg>
          </span>
          <span className="mobile-view-btn-label">Profile</span>
        </Button>
      </div>
    );

    return (
      <>
      {!(isPlayView && this.state.isMobile) ? (
      <Navbar color="dark" dark expand="md" className="px-0 navbar-full">

        {/* FLOPPYSTACK BRAND */}
        <div className="brand-wrap">

          {/* Left placeholder for floppy icon */}
<div className="brand-icon">
  {/* <FloppyStackIcon /> */}
  <Drive1541Icon className="brand-drive" />
</div>
          {/* Text + 1541 lines */}
          <div className="brand-text-wrap">

            {/* TEXT NOW TRUE CASE */}
            <div className="brand-text">
              {brandLabel}
            </div>

<div className="brand-lines">
  <div className="brand-line line-1" />
  <div className="brand-line line-2" />
  <div className="brand-line line-3" />
</div>

          </div>
        </div>

        {this.state.isMobile ? (
          <button
            type="button"
            onClick={this.onRandomPlayClick}
            className={`nav-toggle mobile-play-toggle ${this.state.isOpen ? "is-open" : ""}`}
            disabled={this.state.randomizing}
            title={this.props.hasActiveChallenge ? "Resume Now Playing" : "Random Play"}
            aria-label={this.props.hasActiveChallenge ? "Resume Now Playing" : "Play random game"}
          >
            <span className="navbar-toggler-icon" />
            <span className="mobile-play-btn-label">Play!</span>
            <span className="mobile-play-sonar" aria-hidden="true" />
          </button>
        ) : (
          <NavbarToggler
            onClick={this.toggle}
            className={`nav-toggle ${this.state.isOpen ? "is-open" : ""}`}
            title="Menu"
          />
        )}

        {this.state.isMobile && showSearchControls ? (
          <div className="mobile-inline-search-wrap">
            <div className="search-autocomplete navbar-search-wrap mobile-inline-search">
                <Input
                  type="text"
                  name="gameFilter"
                  className="search-input navbar-search-input"
                  placeholder="Search games..."
                  value={this.state.gameFilter}
                  autoComplete="off"
                  onChange={this.onFilterAdded}
                onFocus={this.onInputFocus}
                onBlur={this.onInputBlur}
                onKeyDown={this.onSearchKeyDown}
              />

              {this.state.gameFilter && (
                <button
                  type="button"
                  className="navbar-search-clear"
                  onClick={this.onClearFilter}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  x
                </button>
              )}

              {shouldShowSuggestions && (
                <div className="search-suggest-menu" role="listbox" aria-label="Game suggestions">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      className={`search-suggest-item ${index === this.state.highlightedSuggestionIndex ? "is-active" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => this.onSelectSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button color="dark" className="navbar-find-btn mobile-inline-find-btn" onClick={this.onSubmitFilter}>
              <span className="navbar-find-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                  <rect x="3" y="1" width="6" height="2" />
                  <rect x="1" y="3" width="2" height="6" />
                  <rect x="9" y="3" width="2" height="6" />
                  <rect x="3" y="9" width="6" height="2" />
                  <rect x="8" y="8" width="2" height="2" />
                  <rect x="10" y="10" width="2" height="2" />
                  <rect x="12" y="12" width="2" height="2" />
                </svg>
              </span>
              <span className="visually-hidden">Find</span>
            </Button>
          </div>
        ) : null}

        <Collapse isOpen={this.state.isOpen} navbar>
          <div className="navbar-panel">
            <div className="navbar-row navbar-row-top">
              {showSearchInTopPanel ? (
                <>
                  <div className="search-autocomplete navbar-search-wrap">
                    <Input
                      type="text"
                      name="gameFilter"
                      className="search-input navbar-search-input"
                      placeholder="Search games..."
                      value={this.state.gameFilter}
                      autoComplete="off"
                      onChange={this.onFilterAdded}
                      onFocus={this.onInputFocus}
                      onBlur={this.onInputBlur}
                      onKeyDown={this.onSearchKeyDown}
                    />

                    {this.state.gameFilter && (
                      <button
                        type="button"
                        className="navbar-search-clear"
                        onClick={this.onClearFilter}
                        aria-label="Clear search"
                        title="Clear search"
                      >
                        x
                      </button>
                    )}

                    {shouldShowSuggestions && (
                      <div className="search-suggest-menu" role="listbox" aria-label="Game suggestions">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={suggestion}
                            type="button"
                            className={`search-suggest-item ${index === this.state.highlightedSuggestionIndex ? "is-active" : ""}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => this.onSelectSuggestion(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button color="dark" className="navbar-find-btn" onClick={this.onSubmitFilter}>
                    <span className="navbar-find-icon" aria-hidden="true">
                      <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                        <rect x="3" y="1" width="6" height="2" />
                        <rect x="1" y="3" width="2" height="6" />
                        <rect x="9" y="3" width="2" height="6" />
                        <rect x="3" y="9" width="6" height="2" />
                        <rect x="8" y="8" width="2" height="2" />
                        <rect x="10" y="10" width="2" height="2" />
                        <rect x="12" y="12" width="2" height="2" />
                      </svg>
                    </span>
                    <span className="visually-hidden">Find</span>
                  </Button>
                </>
              ) : null}

            </div>

            <div className="navbar-row navbar-row-bottom">
              <div className="view-mode-wrap" aria-label="Choose view">
                <div className="view-badge" title="View">
                  <span className="view-badge-icon" aria-hidden="true">
                    <svg viewBox="0 0 18 12" focusable="false" aria-hidden="true">
                      <rect x="4" y="0" width="10" height="2" />
                      <rect x="2" y="2" width="2" height="2" />
                      <rect x="14" y="2" width="2" height="2" />
                      <rect x="0" y="4" width="2" height="4" />
                      <rect x="16" y="4" width="2" height="4" />
                      <rect x="2" y="8" width="2" height="2" />
                      <rect x="14" y="8" width="2" height="2" />
                      <rect x="4" y="10" width="10" height="2" />
                      <rect x="8" y="4" width="2" height="4" />
                    </svg>
                  </span>
                  <span className="view-badge-text">View</span>
                </div>

                <div className="view-segment" role="tablist" aria-label="View switch">
                  <Button
                    color="dark"
                    type="button"
                    onClick={() => this.switchView("disks")}
                    className={`view-segment-btn view-icon-btn ${viewMode === "disks" ? "is-active" : ""}`}
                    aria-current={viewMode === "disks" ? "page" : undefined}
                    title="Disk View"
                  >
                    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                      <rect x="2.5" y="1.5" width="11" height="13" className="icon-outline" />
                      <rect x="4" y="3.5" width="8" height="2.5" className="icon-outline" />
                      <line x1="4" y1="7.5" x2="12" y2="7.5" className="icon-outline" />
                      <rect x="5" y="10" width="6" height="3" className="icon-outline" />
                      <rect x="7" y="11" width="2" height="2" className="icon-fill" />
                    </svg>
                    <span className="visually-hidden">Disk View</span>
                  </Button>
                  <Button
                    color="dark"
                    type="button"
                    onClick={() => this.switchView("games")}
                    className={`view-segment-btn view-icon-btn ${isGameView ? "is-active" : ""}`}
                    aria-current={isGameView ? "page" : undefined}
                    title="Game View"
                  >
                    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                      <rect x="1.5" y="1.5" width="13" height="13" rx="1" ry="1" className="icon-outline" />
                      <circle cx="3.5" cy="3.5" r="1.5" className="icon-accent-fill" />
                      <circle cx="8" cy="8.5" r="4.1" className="icon-outline" />
                      <circle cx="8" cy="8.5" r="2.6" className="icon-outline" />
                      <circle cx="8" cy="8.5" r="1.1" className="icon-fill" />
                    </svg>
                    <span className="visually-hidden">Game View</span>
                  </Button>
                  <Button
                    color="dark"
                    type="button"
                    onClick={() => this.switchView("settings")}
                    className={`view-segment-btn view-icon-btn ${isSettingsView ? "is-active" : ""}`}
                    aria-current={isSettingsView ? "page" : undefined}
                    title="Settings View"
                  >
                    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                      <rect x="1.5" y="2.5" width="13" height="11" className="icon-outline" />
                      <rect x="3" y="4" width="10" height="2" className="icon-outline" />
                      <rect x="3" y="7" width="10" height="2" className="icon-outline" />
                      <rect x="3" y="10" width="10" height="2" className="icon-outline" />

                      <rect x="4" y="4" width="3" height="2" className="icon-fill" />
                      <rect x="9" y="7" width="3" height="2" className="icon-fill" />
                      <rect x="6" y="10" width="3" height="2" className="icon-fill" />

                      <rect x="2.2" y="4.5" width="0.8" height="1" className="icon-fill" />
                      <rect x="13" y="7.5" width="0.8" height="1" className="icon-fill" />
                      <rect x="2.2" y="10.5" width="0.8" height="1" className="icon-fill" />
                    </svg>
                    <span className="visually-hidden">Settings View</span>
                  </Button>
                  <Button
                    color="dark"
                    type="button"
                    onClick={() => this.switchView("play")}
                    className={`view-segment-btn view-icon-btn ${isPlayView ? "is-active" : ""}`}
                    aria-current={isPlayView ? "page" : undefined}
                    title="Play Dashboard"
                  >
                    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                      <rect x="1.5" y="1.5" width="13" height="13" className="icon-outline" />
                      <rect x="6" y="4" width="4" height="1.5" className="icon-fill" />
                      <rect x="5" y="6.2" width="6" height="1.5" className="icon-fill" />
                      <rect x="4" y="8.4" width="8" height="1.5" className="icon-fill" />
                    </svg>
                    <span className="visually-hidden">Now Playing</span>
                  </Button>
                  <Button
                    color="dark"
                    type="button"
                    onClick={() => this.switchView("account")}
                    className={`view-segment-btn view-icon-btn ${isAccountView ? "is-active" : ""}`}
                    aria-current={isAccountView ? "page" : undefined}
                    title="Profile View"
                  >
                    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                      <rect x="6" y="2" width="4" height="3" className="icon-outline" />
                      <rect x="5" y="5" width="6" height="3" className="icon-outline" />
                      <rect x="3.5" y="8.5" width="9" height="4" className="icon-outline" />
                      <rect x="5" y="10" width="2" height="2" className="icon-fill" />
                      <rect x="9" y="10" width="2" height="2" className="icon-fill" />
                    </svg>
                    <span className="visually-hidden">Profile View</span>
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </Collapse>

      </Navbar>
      ) : null}
      {mobileViewBar}
      </>
    );
  }
}

AppNavBarra.propTypes = {
  filterDisks: PropTypes.func.isRequired,
  getItems: PropTypes.func.isRequired,
  itemReducerRef: PropTypes.object,
  viewMode: PropTypes.oneOf(["disks", "games", "settings", "play", "account"]),
  gameSearchValue: PropTypes.string,
  onGameSearchChange: PropTypes.func,
  onViewModeChange: PropTypes.func,
  authUser: PropTypes.shape({
    id: PropTypes.string,
    username: PropTypes.string,
    displayName: PropTypes.string,
  }),
  authLoading: PropTypes.bool,
  authError: PropTypes.string,
  onRegister: PropTypes.func,
  onLogin: PropTypes.func,
  onLogout: PropTypes.func,
  hasActiveChallenge: PropTypes.bool,
  onStartRandomPlay: PropTypes.func,
};

const mapStateToProps = (state) => ({
  itemReducerRef: state.itemReducer
});

export default connect(
  mapStateToProps,
  { filterDisks, getItems }
)(AppNavBarra);
