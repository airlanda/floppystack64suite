import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { DropdownItem, DropdownMenu, DropdownToggle, UncontrolledDropdown } from "reactstrap";
import ThemeSwitcher from "../ThemeSwitcher";
import {
  getThreeInSixtyMinutesPerTarget,
  setThreeInSixtyMinutesPerTarget,
} from "../../services/gamificationService";
import "./StoreSettingsPage.css";

export default function StoreSettingsPage({ onStoresUpdated, authProfileId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stores, setStores] = useState([]);
  const [activeStoreKey, setActiveStoreKey] = useState("");
  const [savingActive, setSavingActive] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    key: "",
    jsonData: "",
  });
  const [addingStore, setAddingStore] = useState(false);
  const [addGamesForm, setAddGamesForm] = useState({
    mode: "existing",
    datasetKey: "",
    newStoreName: "",
    newStoreKey: "",
    diskId: "",
    side: "sideA",
    gamesText: "",
  });
  const [addingGames, setAddingGames] = useState(false);
  const [pendingDeleteStoreId, setPendingDeleteStoreId] = useState("");
  const [deletingStoreId, setDeletingStoreId] = useState("");
  const [notice, setNotice] = useState("");
  const [threeInSixtyMinutes, setThreeInSixtyMinutes] = useState(() =>
    String(getThreeInSixtyMinutesPerTarget(authProfileId || "guest"))
  );
  const [savingGamification, setSavingGamification] = useState(false);
  const availableStores = stores.filter((store) => store.available);
  const selectedTargetStore = availableStores.find((store) => store.id === addGamesForm.datasetKey) || null;

  const loadStores = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stores");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      setStores(Array.isArray(payload?.stores) ? payload.stores : []);
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
      setActiveStoreKey(firstActive || "");
      setAddGamesForm((prev) => ({
        ...prev,
        datasetKey: prev.datasetKey || firstActive || "",
      }));
    } catch (err) {
      setError(err.message || "Failed to load stores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    setThreeInSixtyMinutes(String(getThreeInSixtyMinutesPerTarget(authProfileId || "guest")));
  }, [authProfileId]);

  const saveActiveStores = async () => {
    setSavingActive(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/stores/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: activeStoreKey ? [activeStoreKey] : [] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      setStores(Array.isArray(payload?.stores) ? payload.stores : stores);
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
      setActiveStoreKey(firstActive || "");
      setNotice("Active stores updated.");
      onStoresUpdated?.();
    } catch (err) {
      setError(err.message || "Failed to save active stores");
    } finally {
      setSavingActive(false);
    }
  };

  const onStoreFileSelected = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      setAddForm((prev) => ({ ...prev, jsonData: text }));
      if (!addForm.name) {
        const inferredName = String(file.name || "").replace(/\.[^.]+$/, "");
        setAddForm((prev) => ({ ...prev, name: inferredName || prev.name }));
      }
    } catch (_err) {
      setError("Failed to read selected JSON file.");
    }
  };

  const addStore = async () => {
    setAddingStore(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      setStores(Array.isArray(payload?.stores) ? payload.stores : []);
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
      setActiveStoreKey(firstActive || activeStoreKey);
      setAddForm({ name: "", key: "", jsonData: "" });
      setNotice(`Store '${payload?.created?.name || "new store"}' added.`);
      onStoresUpdated?.();
    } catch (err) {
      setError(err.message || "Failed to add store");
    } finally {
      setAddingStore(false);
    }
  };

  const addGamesToStore = async () => {
    setAddingGames(true);
    setNotice("");
    setError("");
    try {
      const payloadBody =
        addGamesForm.mode === "new"
          ? {
              createStore: true,
              storeName: addGamesForm.newStoreName,
              storeKey: addGamesForm.newStoreKey,
              diskId: addGamesForm.diskId,
              side: addGamesForm.side,
              games: addGamesForm.gamesText,
              activateNewStore: true,
            }
          : {
              datasetKey: addGamesForm.datasetKey,
              diskId: addGamesForm.diskId,
              side: addGamesForm.side,
              games: addGamesForm.gamesText,
            };

      const response = await fetch("/api/stores/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      const nextStores = Array.isArray(payload?.stores) ? payload.stores : [];
      setStores(nextStores);
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
      setActiveStoreKey(firstActive || activeStoreKey);
      setAddGamesForm((prev) => ({
        ...prev,
        datasetKey:
          payload?.result?.dataset ||
          prev.datasetKey ||
          firstActive ||
          "",
        diskId: prev.diskId,
        gamesText: "",
        ...(payload?.createdStore
          ? {
              mode: "existing",
              newStoreName: "",
              newStoreKey: "",
            }
          : {}),
      }));

      const createdStoreName = payload?.createdStore?.name;
      const addedCount = Number(payload?.result?.addedGames || 0);
      setNotice(
        createdStoreName
          ? `Created '${createdStoreName}' and added ${addedCount} game${addedCount === 1 ? "" : "s"}.`
          : `Added ${addedCount} game${addedCount === 1 ? "" : "s"} to store.`
      );
      onStoresUpdated?.();
    } catch (err) {
      setError(err.message || "Failed to add games");
    } finally {
      setAddingGames(false);
    }
  };

  const beginDeleteStore = (storeId) => {
    setPendingDeleteStoreId(storeId);
    setNotice("");
    setError("");
  };

  const cancelDeleteStore = () => {
    setPendingDeleteStoreId("");
  };

  const confirmDeleteStore = async (storeId) => {
    setDeletingStoreId(storeId);
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      const nextStores = Array.isArray(payload?.stores) ? payload.stores : [];
      setStores(nextStores);
      const firstActive = Array.isArray(payload?.activeStoreKeys) ? payload.activeStoreKeys[0] : "";
      setActiveStoreKey(firstActive || "");
      setAddGamesForm((prev) => ({
        ...prev,
        datasetKey: prev.datasetKey === storeId ? firstActive || "" : prev.datasetKey,
      }));
      setPendingDeleteStoreId("");
      setNotice("Store deleted.");
      onStoresUpdated?.();
    } catch (err) {
      setError(err.message || "Failed to delete store");
    } finally {
      setDeletingStoreId("");
    }
  };

  const saveGamificationSettings = async () => {
    setSavingGamification(true);
    setNotice("");
    setError("");
    try {
      const nextMinutes = setThreeInSixtyMinutesPerTarget(threeInSixtyMinutes, authProfileId || "guest");
      setThreeInSixtyMinutes(String(nextMinutes));
      setNotice(`3 in 60 timer set to ${nextMinutes} minute${nextMinutes === 1 ? "" : "s"} per game.`);
    } catch (err) {
      setError(err?.message || "Failed to save gamification settings");
    } finally {
      setSavingGamification(false);
    }
  };

  return (
    <section className="store-settings-root">
      <div className="store-settings-container">
        <h2 className="store-settings-title">Configuration</h2>

        {loading ? <div className="store-settings-note">Loading stores...</div> : null}
        {error ? <div className="store-settings-error">{error}</div> : null}
        {notice ? <div className="store-settings-notice">{notice}</div> : null}

        <div className="store-settings-card">
          <h3>Appearance</h3>
          <div className="store-settings-theme-row">
            <span className="store-settings-theme-label">Theme</span>
            <div className="theme-badge" title="Theme">
              <span className="theme-badge-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path d="M12.2 2.5c-5.3 0-9.6 4-9.6 9.1 0 4.9 4 8.9 9 8.9 2.1 0 3.6-.9 3.6-2.6 0-.8-.4-1.4-.4-2 0-.8.7-1.4 1.6-1.4h1.6c3 0 5.4-2.2 5.4-5.1 0-4.1-4.3-6.9-11.2-6.9z" />
                  <circle cx="7.6" cy="9.4" r="1.2" className="theme-badge-chip" />
                  <circle cx="11.2" cy="7.3" r="1.1" className="theme-badge-chip" />
                  <circle cx="15.1" cy="8.8" r="1.1" className="theme-badge-chip" />
                </svg>
              </span>
              <span className="view-badge-text">Theme</span>
            </div>
            <ThemeSwitcher align="start" compact />
          </div>
        </div>
        <div className="store-settings-card">
          <h3>Gamification</h3>
          <label className="store-settings-field">
            <span>3 in 60 Minutes Per Game</span>
            <input
              type="number"
              min="1"
              max="120"
              step="1"
              value={threeInSixtyMinutes}
              onChange={(e) => setThreeInSixtyMinutes(e.target.value)}
              placeholder="20"
            />
          </label>
          <button
            type="button"
            className="store-settings-btn"
            onClick={saveGamificationSettings}
            disabled={savingGamification}
          >
            {savingGamification ? "Saving..." : "Save Timer"}
          </button>
        </div>

        {!loading ? (
          <div className="store-settings-card">
            <h3>Available Stores</h3>
            <div className="store-settings-list">
              {stores.map((store) => (
                <label key={store.id} className={`store-settings-item ${store.available ? "" : "is-unavailable"}`}>
                  <input
                    type="radio"
                    name="activeStore"
                    checked={activeStoreKey === store.id}
                    onChange={() => setActiveStoreKey(store.id)}
                    disabled={!store.available}
                  />
                  <span className="store-settings-item-main">
                    <span className="store-settings-item-name">{store.name}</span>
                    <span className="store-settings-item-meta">
                      {store.type === "builtin" ? "Built-in" : "Custom"} | {Number(store.diskCount || 0)} disk
                      {Number(store.diskCount || 0) === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="store-settings-item-actions">
                    {store.type !== "builtin" ? (
                      pendingDeleteStoreId === store.id ? (
                        <>
                          <button
                            type="button"
                            className="store-settings-btn is-danger"
                            onClick={() => confirmDeleteStore(store.id)}
                            disabled={deletingStoreId === store.id}
                          >
                            {deletingStoreId === store.id ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            className="store-settings-btn"
                            onClick={cancelDeleteStore}
                            disabled={deletingStoreId === store.id}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="store-settings-btn is-danger"
                          onClick={() => beginDeleteStore(store.id)}
                        >
                          <span className="store-settings-delete-text">Delete</span>
                          <span className="store-settings-btn-icon" aria-hidden="true">
                            <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                              <rect x="6" y="3.2" width="8" height="1.8" fill="currentColor" />
                              <rect x="5" y="6" width="10" height="10.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                              <rect x="8" y="1.6" width="4" height="1.6" fill="currentColor" />
                              <rect x="7.2" y="8.2" width="1.5" height="6.2" fill="currentColor" />
                              <rect x="11.3" y="8.2" width="1.5" height="6.2" fill="currentColor" />
                            </svg>
                          </span>
                        </button>
                      )
                    ) : (
                      <span className="store-settings-item-meta">Protected</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="store-settings-btn"
              onClick={saveActiveStores}
              disabled={savingActive || !activeStoreKey}
            >
              {savingActive ? "Saving..." : "Save Active Stores"}
            </button>
          </div>
        ) : null}

        <div className="store-settings-card">
          <h3>Add Games to Store</h3>

          <div className="store-settings-mode-row">
            <label className="store-settings-inline-option">
              <input
                type="radio"
                name="storeTargetMode"
                checked={addGamesForm.mode === "existing"}
                onChange={() => setAddGamesForm((prev) => ({ ...prev, mode: "existing" }))}
              />
              <span>Existing Store</span>
            </label>
            <label className="store-settings-inline-option">
              <input
                type="radio"
                name="storeTargetMode"
                checked={addGamesForm.mode === "new"}
                onChange={() => setAddGamesForm((prev) => ({ ...prev, mode: "new" }))}
              />
              <span>New Store</span>
            </label>
          </div>

          {addGamesForm.mode === "existing" ? (
            <label className="store-settings-field">
              <span>Target Store</span>
              <UncontrolledDropdown className="store-settings-dropdown">
                <DropdownToggle color="dark" caret className="store-settings-dropdown-toggle">
                  {selectedTargetStore ? selectedTargetStore.name : "Select a store..."}
                </DropdownToggle>
                <DropdownMenu className="store-settings-dropdown-menu">
                  <DropdownItem
                    className="store-settings-dropdown-item"
                    active={!addGamesForm.datasetKey}
                    onClick={() => setAddGamesForm((prev) => ({ ...prev, datasetKey: "" }))}
                  >
                    Select a store...
                  </DropdownItem>
                  {availableStores.map((store) => (
                    <DropdownItem
                      key={store.id}
                      className="store-settings-dropdown-item"
                      active={addGamesForm.datasetKey === store.id}
                      onClick={() => setAddGamesForm((prev) => ({ ...prev, datasetKey: store.id }))}
                    >
                      {store.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </UncontrolledDropdown>
            </label>
          ) : (
            <>
              <label className="store-settings-field">
                <span>New Store Name</span>
                <input
                  type="text"
                  value={addGamesForm.newStoreName}
                  onChange={(e) => setAddGamesForm((prev) => ({ ...prev, newStoreName: e.target.value }))}
                  placeholder="My New Store"
                />
              </label>
              <label className="store-settings-field">
                <span>New Store Key (optional)</span>
                <input
                  type="text"
                  value={addGamesForm.newStoreKey}
                  onChange={(e) => setAddGamesForm((prev) => ({ ...prev, newStoreKey: e.target.value }))}
                  placeholder="my-new-store"
                />
              </label>
            </>
          )}

          <div className="store-settings-add-grid">
            <label className="store-settings-field">
              <span>Disk ID</span>
              <input
                type="text"
                value={addGamesForm.diskId}
                onChange={(e) => setAddGamesForm((prev) => ({ ...prev, diskId: e.target.value }))}
                placeholder="1"
              />
            </label>
            <label className="store-settings-field">
              <span>Side</span>
              <UncontrolledDropdown className="store-settings-dropdown">
                <DropdownToggle color="dark" caret className="store-settings-dropdown-toggle">
                  {addGamesForm.side === "sideB" ? "Side B" : "Side A"}
                </DropdownToggle>
                <DropdownMenu className="store-settings-dropdown-menu">
                  <DropdownItem
                    className="store-settings-dropdown-item"
                    active={addGamesForm.side === "sideA"}
                    onClick={() => setAddGamesForm((prev) => ({ ...prev, side: "sideA" }))}
                  >
                    Side A
                  </DropdownItem>
                  <DropdownItem
                    className="store-settings-dropdown-item"
                    active={addGamesForm.side === "sideB"}
                    onClick={() => setAddGamesForm((prev) => ({ ...prev, side: "sideB" }))}
                  >
                    Side B
                  </DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            </label>
          </div>

          <label className="store-settings-field">
            <span>Games (one per line)</span>
            <textarea
              rows={8}
              value={addGamesForm.gamesText}
              onChange={(e) => setAddGamesForm((prev) => ({ ...prev, gamesText: e.target.value }))}
              placeholder={`Pitstop II\nImpossible Mission\nSummer Games`}
            />
          </label>

          <button
            type="button"
            className="store-settings-btn"
            onClick={addGamesToStore}
            disabled={addingGames}
          >
            {addingGames ? "Saving..." : "Add Games"}
          </button>
        </div>

        <div className="store-settings-card">
          <h3>Add JSON Store</h3>
          <label className="store-settings-field">
            <span>Name</span>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="My Game Collection"
            />
          </label>
          <label className="store-settings-field">
            <span>Key (optional)</span>
            <input
              type="text"
              value={addForm.key}
              onChange={(e) => setAddForm((prev) => ({ ...prev, key: e.target.value }))}
              placeholder="my-collection"
            />
          </label>
          <label className="store-settings-field">
            <span>Upload JSON file</span>
            <input type="file" accept=".json,application/json" onChange={onStoreFileSelected} />
          </label>
          <label className="store-settings-field">
            <span>JSON Data</span>
            <textarea
              rows={8}
              value={addForm.jsonData}
              onChange={(e) => setAddForm((prev) => ({ ...prev, jsonData: e.target.value }))}
              placeholder='[{"_id":"1","sideA":[{"gameName":"1942"}],"sideB":[]}]'
            />
          </label>
          <button
            type="button"
            className="store-settings-btn"
            onClick={addStore}
            disabled={addingStore}
          >
            {addingStore ? "Adding..." : "Add Store"}
          </button>
        </div>
      </div>
    </section>
  );
}

StoreSettingsPage.propTypes = {
  onStoresUpdated: PropTypes.func,
  authProfileId: PropTypes.string,
};
