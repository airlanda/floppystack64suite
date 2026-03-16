import React, { Component } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

import {
  deleteDiskFromDataset,
  getItems,
  deleteItem,
  saveGameTitles,
  updateGameRating,
} from "../../actions/itemActions.js";
import DiskStage from "./DiskStage.jsx";
import GameMetadataPanel from "./GameMetadataPanel.jsx";

import "./DiskInventory.css";

class DiskInventory extends Component {
  ignoreSwipeGesture = false;
  snackbarTimers = new Map();
  metadataHistoryEntryActive = false;
  suppressNextMetadataPopState = false;
  metadataHistoryBarrierPushed = false;

  state = {
    currentDisk: 0,
    touchStartX: 0,
    touchStartY: 0,
    savingRatings: {},
    metadataLookupProvider: "thegamesdb",
    selectedMetadataGame: null,
    snackbars: [],
    mobileRatingMode: false,
    activeMobileEditorKey: null,
    deletingCurrentDisk: false,
    metadataClosing: false,
  };

  componentDidMount() {
    this.props.getItems();
    this.updateViewportMode();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.updateViewportMode);
      window.addEventListener("popstate", this.onWindowPopState);
    }
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.updateViewportMode);
      window.removeEventListener("popstate", this.onWindowPopState);
    }
    this.snackbarTimers.forEach((timerId) => clearTimeout(timerId));
    this.snackbarTimers.clear();
  }

  componentDidUpdate(prevProps, prevState) {
    const prevItems = prevProps.itemReducerRef.itemsArrayInsideState;
    const nextItems = this.props.itemReducerRef.itemsArrayInsideState;
    const storeConfigChanged = prevProps.storeConfigVersion !== this.props.storeConfigVersion;

    if (storeConfigChanged) {
      this.props.getItems();
      if (this.state.currentDisk !== 0) {
        this.setState({ currentDisk: 0, activeMobileEditorKey: null });
      }
    }

    if (prevItems !== nextItems) {
      const nextLen = Array.isArray(nextItems) ? nextItems.length : 0;

      if (nextLen === 0) {
        if (this.state.currentDisk !== 0 || this.state.activeMobileEditorKey) {
          this.setState({ currentDisk: 0, activeMobileEditorKey: null });
        }
        return;
      }

      if (this.state.currentDisk >= nextLen) {
        this.setState({ currentDisk: 0, activeMobileEditorKey: null });
      }
    }

    const metadataWasOpen = Boolean(prevState.selectedMetadataGame);
    const metadataIsOpen = Boolean(this.state.selectedMetadataGame);
    const mobileRouteMode = Boolean(this.state.mobileRatingMode);

    // Keep browser history in sync with mobile metadata overlay so
    // Android/system back closes metadata first before leaving the page.
    // We push a root barrier state once, then a metadata state, so first Back
    // always returns to the app's main screen (not an external previous page).
    if (!metadataWasOpen && metadataIsOpen && mobileRouteMode && typeof window !== "undefined") {
      if (!this.metadataHistoryBarrierPushed) {
        window.history.pushState({ fs64: "root" }, "");
        this.metadataHistoryBarrierPushed = true;
      }
      window.history.pushState({ fs64: "metadata" }, "");
      this.metadataHistoryEntryActive = true;
    }

    if (metadataWasOpen && !metadataIsOpen) {
      this.metadataHistoryEntryActive = false;
    }
  }

  onWindowPopState = () => {
    if (this.suppressNextMetadataPopState) {
      this.suppressNextMetadataPopState = false;
      this.metadataHistoryEntryActive = false;
      this.setState({ selectedMetadataGame: null, metadataClosing: false });
      return;
    }

    if (!this.state.selectedMetadataGame) return;
    this.metadataHistoryEntryActive = false;
    this.setState({ metadataClosing: true });
    window.setTimeout(() => {
      this.setState({ selectedMetadataGame: null, metadataClosing: false });
    }, 190);
  };

  closeMetadataPanel = () => {
    if (!this.state.selectedMetadataGame) return;

    this.setState({ metadataClosing: true });

    // If metadata pushed a history entry, consume it on close so browser
    // back stack remains natural and consistent with route-like behavior.
    window.setTimeout(() => {
      if (this.metadataHistoryEntryActive && typeof window !== "undefined") {
        this.suppressNextMetadataPopState = true;
        window.history.back();
        return;
      }

      this.setState({ selectedMetadataGame: null, metadataClosing: false });
    }, 190);
  };

  onNextDisk = () => {
    const { itemsArrayInsideState } = this.props.itemReducerRef;
    if (!itemsArrayInsideState || itemsArrayInsideState.length === 0) return;

    this.setState((s) => ({
      currentDisk:
        s.currentDisk === itemsArrayInsideState.length - 1 ? 0 : s.currentDisk + 1,
      activeMobileEditorKey: null,
    }));
  };

  onPreviousDisk = () => {
    const { itemsArrayInsideState } = this.props.itemReducerRef;
    if (!itemsArrayInsideState || itemsArrayInsideState.length === 0) return;

    this.setState((s) => ({
      currentDisk:
        s.currentDisk === 0 ? itemsArrayInsideState.length - 1 : s.currentDisk - 1,
      activeMobileEditorKey: null,
    }));
  };

  handleTouchStart = (e) => {
    if (this.state.selectedMetadataGame || this.state.metadataClosing) {
      this.ignoreSwipeGesture = true;
      return;
    }

    this.ignoreSwipeGesture = Boolean(
      e.target?.closest?.(".rating-mobile-editor, .rating-mobile-trigger")
    );

    if (this.ignoreSwipeGesture) return;

    // Do NOT preventDefault here; it breaks vertical scrolling.
    this.setState({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
    });
  };

  handleTouchEnd = (e) => {
    if (this.state.selectedMetadataGame || this.state.metadataClosing) {
      this.ignoreSwipeGesture = false;
      return;
    }

    if (this.ignoreSwipeGesture) {
      this.ignoreSwipeGesture = false;
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - this.state.touchStartX;
    const deltaY = touchEndY - this.state.touchStartY;

    // Only consider horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      e.preventDefault();
      if (deltaX > 0) this.onPreviousDisk();
      else this.onNextDisk();
    }
  };

  updateViewportMode = () => {
    if (typeof window === "undefined") return;
    const nextIsMobile = window.matchMedia("(max-width: 768px)").matches;
    if (nextIsMobile !== this.state.mobileRatingMode) {
      this.setState({
        mobileRatingMode: nextIsMobile,
        activeMobileEditorKey: nextIsMobile ? this.state.activeMobileEditorKey : null,
      });
    }
  };

  makeRatingSaveKey = ({ diskId, side, gameIndex, gameName }) =>
    `${diskId}|${side}|${gameIndex}|${String(gameName)}`;

  onRateGame = async (payload) => {
    const saveKey = this.makeRatingSaveKey(payload);

    this.setState((prev) => ({
      savingRatings: { ...prev.savingRatings, [saveKey]: true },
    }));

    try {
      await this.props.updateGameRating(payload);
    } catch (error) {
      console.error("Failed to save game rating", error);
    } finally {
      this.setState((prev) => {
        const nextSaving = { ...prev.savingRatings };
        delete nextSaving[saveKey];
        return { savingRatings: nextSaving };
      });
    }
  };

  onSelectGame = ({ diskId, side, gameIndex, gameName }) => {
    this.setState({
      metadataClosing: false,
      selectedMetadataGame: {
        selectionKey: `${diskId}|${side}|${gameIndex}|${String(gameName)}|${Date.now()}`,
        diskId,
        side,
        sideLabel: side === "sideA" ? "Side A" : side === "sideB" ? "Side B" : String(side),
        gameIndex,
        gameName,
      },
    });
  };

  onStartRandomChallenge = async () => {
    const disks = this.props.itemReducerRef?.itemsArrayInsideState || [];
    const result = await this.props.onStartRandomPlay?.(disks);
    if (result && result.ok === false) {
      this.pushSnackbar({ message: result.error || "Unable to start random play.", tone: "warning" });
    }
  };

  onSaveGameTitles = async ({ dataset, diskId, side, titles }) => {
    await saveGameTitles({ dataset, diskId, side, titles });
    this.props.getItems();
  };

  onDeleteCurrentDisk = async () => {
    const { itemsArrayInsideState } = this.props.itemReducerRef;
    const currentDisk = Array.isArray(itemsArrayInsideState)
      ? itemsArrayInsideState[this.state.currentDisk]
      : null;
    if (!currentDisk || this.state.deletingCurrentDisk) return;

    const dataset = currentDisk.datasetKey || "default";
    const diskId = currentDisk._id;

    const confirmed = typeof window !== "undefined"
      ? window.confirm(`Delete disk ${diskId} from store '${dataset}'?`)
      : true;

    if (!confirmed) return;

    this.setState({ deletingCurrentDisk: true });
    try {
      await deleteDiskFromDataset({ dataset, diskId });
      this.pushSnackbar({
        message: `Disk ${diskId} deleted from ${dataset}.`,
        tone: "success",
      });
      this.props.getItems();
    } catch (error) {
      console.error("Failed to delete disk:", error);
      this.pushSnackbar({
        message: error?.response?.data?.error || error?.message || "Failed to delete disk.",
        tone: "error",
      });
    } finally {
      this.setState({ deletingCurrentDisk: false });
    }
  };

  pushSnackbar = ({ message, tone = "info" }) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.setState((prev) => ({
      snackbars: [...prev.snackbars, { id, message, tone }],
    }));

    const timerId = setTimeout(() => {
      this.dismissSnackbar(id);
    }, 2800);

    this.snackbarTimers.set(id, timerId);
  };

  dismissSnackbar = (id) => {
    const timerId = this.snackbarTimers.get(id);
    if (timerId) {
      clearTimeout(timerId);
      this.snackbarTimers.delete(id);
    }

    this.setState((prev) => ({
      snackbars: prev.snackbars.filter((snackbar) => snackbar.id !== id),
    }));
  };

  render() {
    const { itemsArrayInsideState, originalList, loading } = this.props.itemReducerRef;

    const totalDisks = Array.isArray(originalList) ? originalList.length : 0;
    const shownDisks = Array.isArray(itemsArrayInsideState) ? itemsArrayInsideState.length : 0;

    if (loading) return <div>Loading Data</div>;
    if (totalDisks === 0 && shownDisks === 0) return <div>No data yet</div>;

    // Filtered-to-zero case: show a friendly message
    if (shownDisks === 0 && totalDisks > 0) {
      return (
        <div className="c64-root">
          <div className="c64-container">
            <div className="c64-topbar">
              <div className="c64-count-center">
                <div className="c64-count">
                  Showing <b>0</b> of <b>{totalDisks}</b> disks
                </div>
              </div>
            </div>

            <div className="c64-empty">No matches for that game name.</div>
          </div>
        </div>
      );
    }

    const currentDisk = itemsArrayInsideState[this.state.currentDisk];
    if (!currentDisk) return <div>No matches</div>;
    const currentStoreLabel =
      currentDisk.datasetName || currentDisk.datasetKey || "Default";

    return (
      <div
        className="c64-root"
        onTouchStart={this.handleTouchStart}
        onTouchEnd={this.handleTouchEnd}
      >
        <div className="c64-container">
          <div className="c64-topbar">
            <div className="c64-randomizer-wrap c64-randomizer-wrap-desktop">
              <button
                type="button"
                className="c64-randomizer-btn c64-randomizer-btn-play mobile-play-toggle nav-toggle"
                onClick={this.onStartRandomChallenge}
                title="Random Play"
                aria-label="Random Play"
              >
                <span className="navbar-toggler-icon" />
                <span className="c64-randomizer-label">Play!</span>
                <span className="c64-randomizer-sonar" aria-hidden="true" />
              </button>
            </div>
            <div className="c64-count-center">
              <div className="c64-count">
                {this.props.activeChallenge?.target ? (
                  <>
                    Now Playing: <b>{this.props.activeChallenge.target.gameName}</b>
                  </>
                ) : (
                  <>
                    <b>{shownDisks}</b> {Number(shownDisks) === 1 ? "Disk" : "Disks"}
                  </>
                )}
              </div>
            </div>
            <div className="c64-store-indicator">
              Store: <b>{currentStoreLabel}</b>
            </div>
          </div>

          <DiskStage
            currentDisk={currentDisk}
            totalDisks={shownDisks}
            onPrev={this.onPreviousDisk}
            onNext={this.onNextDisk}
            onRateGame={this.onRateGame}
            onSelectGame={this.onSelectGame}
            ratingSaveMap={this.state.savingRatings}
            mobileRatingMode={this.state.mobileRatingMode}
            activeMobileEditorKey={this.state.activeMobileEditorKey}
            onSetActiveMobileEditorKey={(key) => this.setState({ activeMobileEditorKey: key })}
            onSaveGameTitles={this.onSaveGameTitles}
            onDeleteDisk={this.onDeleteCurrentDisk}
            deletingDisk={this.state.deletingCurrentDisk}
            randomChallengeTarget={this.props.activeChallenge?.target || null}
          />

          {this.state.selectedMetadataGame && (
            <GameMetadataPanel
              selectedGame={this.state.selectedMetadataGame}
              lookupProvider={this.state.metadataLookupProvider}
              onLookupProviderChange={(provider) => this.setState({ metadataLookupProvider: provider })}
              onClose={this.closeMetadataPanel}
              onNotify={this.pushSnackbar}
              mobileRouteMode={this.state.mobileRatingMode}
              closing={this.state.metadataClosing}
            />
          )}

          <div className="c64-snackbar-stack" aria-live="polite" aria-atomic="false">
            {this.state.snackbars.map((snackbar) => (
              <div
                key={snackbar.id}
                className={`c64-snackbar c64-snackbar-${snackbar.tone || "info"}`}
                role="status"
              >
                <span>{snackbar.message}</span>
                <button
                  type="button"
                  className="c64-snackbar-close"
                  onClick={() => this.dismissSnackbar(snackbar.id)}
                  aria-label="Dismiss notification"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

DiskInventory.propTypes = {
  getItems: PropTypes.func.isRequired,
  deleteItem: PropTypes.func.isRequired,
  updateGameRating: PropTypes.func.isRequired,
  itemReducerRef: PropTypes.object.isRequired,
  storeConfigVersion: PropTypes.number,
  activeChallenge: PropTypes.object,
  onStartRandomPlay: PropTypes.func,
};

const mapStateToProps = (state) => ({
  itemReducerRef: state.itemReducer,
});

export default connect(mapStateToProps, { getItems, deleteItem, updateGameRating })(DiskInventory);
