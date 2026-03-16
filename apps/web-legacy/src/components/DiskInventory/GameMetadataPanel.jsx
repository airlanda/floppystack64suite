import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { DropdownItem, DropdownMenu, DropdownToggle, UncontrolledDropdown } from "reactstrap";

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
  const exact = list.find((record) => normalizeName(record?.gameName) === wanted);
  if (exact) return exact;

  const canonical = list.find((record) => normalizeName(record?.canonicalTitle) === wanted);
  if (canonical) return canonical;

  return list[0] || null;
}

function hasMetadataContent(record) {
  if (!record || typeof record !== "object") return false;
  return Boolean(
    record.description ||
      record.genre ||
      record.developer ||
      record.publisher ||
      record.year ||
      record.players ||
      record.images?.boxFront ||
      record.images?.screenshot ||
      record.images?.logo ||
      (record.source?.status && record.source.status === "fetched")
  );
}

function displayValue(value) {
  if (value == null || value === "") return "Unknown";
  return String(value);
}

function makeDraftFromRecord(record, fallbackGameName) {
  return {
    canonicalTitle: record?.canonicalTitle || fallbackGameName || "",
    description: record?.description || "",
    genre: record?.genre || "",
    developer: record?.developer || "",
    publisher: record?.publisher || "",
    year: record?.year || "",
    players: record?.players || "",
    boxFront: record?.images?.boxFront || "",
  };
}

export default function GameMetadataPanel({
  selectedGame,
  lookupProvider = "thegamesdb",
  onLookupProviderChange,
  onClose,
  onNotify,
  mobileRouteMode = false,
  closing = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [record, setRecord] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualImagePreview, setManualImagePreview] = useState(null);
  const [manualImageName, setManualImageName] = useState("");
  const [manualDraft, setManualDraft] = useState(makeDraftFromRecord(null, ""));
  const touchStartRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    let cancelled = false;

    async function loadStoredRecord() {
      if (!selectedGame?.gameName) {
        setRecord(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setLookupError(null);

      try {
        const response = await fetch(
          `/api/metadata/records?q=${encodeURIComponent(selectedGame.gameName)}&limit=25`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json();
        if (cancelled) return;
        setRecord(pickBestRecord(payload?.records, selectedGame.gameName));
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load metadata");
        setRecord(null);
        onNotify?.({
          message: `Failed to load stored metadata for ${selectedGame.gameName}`,
          tone: "error",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStoredRecord();
    return () => {
      cancelled = true;
    };
  }, [selectedGame?.selectionKey, selectedGame?.gameName, onNotify]);

  useEffect(() => {
    if (!selectedGame) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedGame, onClose]);

  useEffect(() => {
    setManualMode(false);
    setManualImagePreview(null);
    setManualImageName("");
    setLookupError(null);
  }, [selectedGame?.selectionKey]);

  useEffect(() => {
    setManualDraft(makeDraftFromRecord(record, selectedGame?.gameName || ""));
  }, [record, selectedGame?.gameName]);

  const imageUrl = record?.images?.boxFront || record?.images?.screenshot || record?.images?.logo || null;
  const displayedImageUrl = manualMode && manualDraft.boxFront ? manualDraft.boxFront : imageUrl;
  const providerLabel = lookupProvider === "thegamesdb" ? "TheGamesDB" : "Hybrid";

  useEffect(() => {
    setImageLoading(Boolean(displayedImageUrl));
  }, [displayedImageUrl]);

  if (!selectedGame) return null;

  const onMobileTouchStart = (event) => {
    if (!mobileRouteMode) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    // Keep swipe-back available across the panel, but don't start the gesture
    // from interactive controls where touch should stay local.
    const origin = event.target;
    if (origin?.closest?.("input, textarea, select, button, a, [role='button']")) {
      touchStartRef.current = { x: 0, y: 0, active: false };
      return;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, active: true };
  };

  const onMobileTouchEnd = (event) => {
    if (!mobileRouteMode || !touchStartRef.current.active) return;
    const touch = event.changedTouches && event.changedTouches[0];
    touchStartRef.current.active = false;
    if (!touch) return;

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Mobile route gesture: any strong horizontal swipe closes panel.
    // Guard against vertical scroll by requiring stronger horizontal movement.
    if (Math.abs(deltaX) > 64 && Math.abs(deltaX) > deltaY * 1.4) {
      onClose?.();
    }
  };

  const requestLookup = async () => {
    if (!selectedGame?.gameName || lookupLoading) return;

    setLookupLoading(true);
    setLookupError(null);
    try {
      const response = await fetch("/api/metadata/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameName: selectedGame.gameName,
          provider: lookupProvider,
          persist: true,
          downloadImages: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      const nextRecord = payload?.stored || payload?.result || null;
      setRecord(nextRecord);
      const found = Boolean(payload?.found ?? payload?.result?.found);
      const sourceProvider = payload?.result?.source?.provider || lookupProvider;
      onNotify?.({
        message: found
          ? `Metadata updated for ${selectedGame.gameName} (${sourceProvider})`
          : `No metadata found for ${selectedGame.gameName} (${sourceProvider})`,
        tone: found ? "success" : "warning",
      });
    } catch (err) {
      const message = err.message || "Lookup failed";
      setLookupError(message);
      onNotify?.({
        message: `Metadata lookup failed for ${selectedGame.gameName}: ${message}`,
        tone: "error",
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const onManualFieldChange = (field, value) => {
    setManualDraft((prev) => ({ ...prev, [field]: value }));
  };

  const onManualImageChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      onNotify?.({ message: "Please choose an image file", tone: "warning" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        onNotify?.({ message: "Failed to read selected image", tone: "error" });
        return;
      }
      setManualImagePreview(dataUrl);
      setManualImageName(file.name || "uploaded-image");
      setManualDraft((prev) => ({ ...prev, boxFront: dataUrl }));
    };
    reader.onerror = () => onNotify?.({ message: "Failed to read selected image", tone: "error" });
    reader.readAsDataURL(file);
  };

  const resetManualEditor = () => {
    setManualMode(false);
    setManualImagePreview(null);
    setManualImageName("");
    setManualDraft(makeDraftFromRecord(record, selectedGame?.gameName || ""));
  };

  const saveManualMetadata = async () => {
    if (!selectedGame?.gameName || manualSaving) return;

    setManualSaving(true);
    setLookupError(null);
    try {
      const body = {
        gameName: selectedGame.gameName,
        platform: "c64",
        metadata: {
          canonicalTitle: manualDraft.canonicalTitle,
          description: manualDraft.description,
          genre: manualDraft.genre,
          developer: manualDraft.developer,
          publisher: manualDraft.publisher,
          year: manualDraft.year,
          players: manualDraft.players,
        },
        images: {
          boxFront:
            manualDraft.boxFront && !String(manualDraft.boxFront).startsWith("data:")
              ? manualDraft.boxFront
              : undefined,
        },
        uploads:
          manualDraft.boxFront && String(manualDraft.boxFront).startsWith("data:")
            ? {
                boxFront: {
                  dataUrl: manualDraft.boxFront,
                  fileName: manualImageName || "boxfront-upload",
                },
              }
            : {},
      };

      const response = await fetch("/api/metadata/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRecord(payload?.stored || null);
      setManualMode(false);
      setManualImagePreview(null);
      setManualImageName("");
      onNotify?.({ message: `Manual metadata saved for ${selectedGame.gameName}`, tone: "success" });
    } catch (err) {
      const msg = err.message || "Manual save failed";
      setLookupError(msg);
      onNotify?.({ message: `Manual save failed for ${selectedGame.gameName}: ${msg}`, tone: "error" });
    } finally {
      setManualSaving(false);
    }
  };

  return (
    <div
      className={`game-meta-modal${mobileRouteMode ? " game-meta-modal-mobile" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-meta-title"
      onClick={mobileRouteMode ? undefined : () => onClose?.()}
    >
      <section
        className={`game-meta-panel${mobileRouteMode ? " game-meta-panel-mobile" : ""}${closing ? " is-closing" : ""}`}
        onTouchStart={onMobileTouchStart}
        onTouchEnd={onMobileTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="game-meta-panel-header">
          <div className="game-meta-panel-heading game-meta-panel-heading-full">
            <div className="game-meta-appbar" role="toolbar" aria-label="Metadata actions">
              <div className="game-meta-appbar-title">Game Data</div>
              <div className="game-meta-appbar-actions">
                <button
                  type="button"
                  className="game-meta-appbar-btn game-meta-appbar-icon-btn"
                  onClick={requestLookup}
                  disabled={lookupLoading}
                  title={lookupLoading ? "Refreshing metadata..." : "Refresh metadata"}
                  aria-label={lookupLoading ? "Refreshing metadata" : "Refresh metadata"}
                >
                  <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                    <path d="M8 2a6 6 0 1 0 5.2 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M10.8 1.7H14v3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M14 1.7 11.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`game-meta-appbar-btn game-meta-appbar-icon-btn game-meta-edit-btn${manualMode ? " is-active" : ""}`}
                  onClick={() => setManualMode((prev) => !prev)}
                  aria-pressed={manualMode}
                  title={manualMode ? "Close metadata editor" : "Edit metadata"}
                  aria-label={manualMode ? "Close metadata editor" : "Edit metadata"}
                >
                  <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                    <rect x="2" y="2" width="9" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="4" y="5" width="5" height="1.2" fill="currentColor" />
                    <rect x="4" y="7.5" width="4" height="1.2" fill="currentColor" />
                    <rect x="11" y="10.2" width="2" height="2" fill="currentColor" />
                    <rect x="12.6" y="8.6" width="2" height="2" fill="currentColor" />
                    <rect x="14.2" y="7" width="2" height="2" fill="currentColor" />
                    <rect x="15.8" y="5.4" width="1.6" height="1.6" fill="currentColor" />
                    <rect x="10.4" y="11.8" width="1.4" height="1.4" fill="#000" opacity="0.4" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="game-meta-appbar-btn game-meta-appbar-icon-btn game-meta-close-btn"
                  onClick={onClose}
                  aria-label="Close metadata panel"
                  title="Close panel"
                >
                  <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                    <rect x="1.5" y="1.5" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <rect x="4" y="4" width="2" height="2" />
                    <rect x="6" y="6" width="2" height="2" />
                    <rect x="8" y="8" width="2" height="2" />
                    <rect x="10" y="10" width="2" height="2" />
                    <rect x="10" y="4" width="2" height="2" />
                    <rect x="8" y="6" width="2" height="2" />
                    <rect x="6" y="8" width="2" height="2" />
                    <rect x="4" y="10" width="2" height="2" />
                  </svg>
                </button>
              </div>
            </div>

            <h3 id="game-meta-title" className="game-meta-panel-title game-meta-panel-title-row">
              {selectedGame.gameName}
            </h3>

            <div className="game-meta-panel-subtitle">
              Disk {selectedGame.diskId} | {selectedGame.sideLabel}
            </div>
            <div className="game-meta-provider-toggle" role="group" aria-label="Metadata provider">
              <span className="game-meta-provider-label">Provider</span>
              <UncontrolledDropdown className="game-meta-provider-dropdown">
                <DropdownToggle
                  color="dark"
                  caret
                  className="game-meta-provider-toggle-btn"
                  title="Metadata provider"
                  aria-label={`Metadata provider: ${providerLabel}`}
                >
                  {providerLabel}
                </DropdownToggle>
                <DropdownMenu end className="game-meta-provider-dropdown-menu">
                  <DropdownItem
                    className="game-meta-provider-dropdown-item"
                    active={lookupProvider === "thegamesdb"}
                    onClick={() => onLookupProviderChange?.("thegamesdb")}
                  >
                    TheGamesDB
                  </DropdownItem>
                  <DropdownItem
                    className="game-meta-provider-dropdown-item"
                    active={lookupProvider === "hybrid"}
                    onClick={() => onLookupProviderChange?.("hybrid")}
                  >
                    Hybrid
                  </DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
              <button
                type="button"
                className="game-meta-provider-fetch-btn"
                onClick={requestLookup}
                disabled={lookupLoading}
              >
                <span>{lookupLoading ? "Fetching..." : "Fetch"}</span>
                <svg className="game-meta-fetch-icon" viewBox="0 0 20 16" focusable="false" aria-hidden="true">
                  <rect x="2" y="2" width="4" height="1" fill="#ffffff" />
                  <rect x="2" y="3" width="5" height="1" fill="#ffffff" />
                  <rect x="3" y="4" width="6" height="1" fill="#ffffff" />
                  <rect x="4" y="5" width="7" height="1" fill="#ffffff" />
                  <rect x="4" y="6" width="4" height="1" fill="#ffffff" />
                  <rect x="4" y="9" width="4" height="1" fill="#ffffff" />
                  <rect x="4" y="10" width="7" height="1" fill="#ffffff" />
                  <rect x="3" y="11" width="6" height="1" fill="#ffffff" />
                  <rect x="2" y="12" width="5" height="1" fill="#ffffff" />
                  <rect x="2" y="13" width="4" height="1" fill="#ffffff" />

                  <rect x="10" y="3" width="3" height="1" fill="#9a9a9a" />
                  <rect x="9" y="4" width="4" height="1" fill="#9a9a9a" />
                  <rect x="6" y="6" width="3" height="1" fill="#7f7f7f" />
                  <rect x="6" y="7" width="4" height="1" fill="#7f7f7f" />
                  <rect x="6" y="8" width="4" height="1" fill="#7f7f7f" />
                  <rect x="6" y="9" width="3" height="1" fill="#7f7f7f" />
                  <rect x="10" y="7" width="8" height="1" fill="#7f7f7f" />
                  <rect x="10" y="8" width="8" height="1" fill="#7f7f7f" />
                  <rect x="9" y="11" width="4" height="1" fill="#9a9a9a" />
                  <rect x="10" y="12" width="3" height="1" fill="#9a9a9a" />

                  <rect x="8" y="5" width="2" height="1" fill="#ffffff" />
                  <rect x="8" y="6" width="4" height="1" fill="#ffffff" />
                  <rect x="8" y="7" width="7" height="1" fill="#ffffff" />
                  <rect x="8" y="8" width="7" height="1" fill="#ffffff" />
                  <rect x="8" y="9" width="4" height="1" fill="#ffffff" />
                  <rect x="8" y="10" width="2" height="1" fill="#ffffff" />

                  <rect x="0" y="5" width="4" height="1" fill="#a9564e" />
                  <rect x="0" y="8" width="4" height="1" fill="#a9564e" />
                  <rect x="0" y="11" width="4" height="1" fill="#a9564e" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="game-meta-panel-body">
          <div className="game-meta-art">
            {loading || lookupLoading || manualSaving || imageLoading ? (
              <div className="game-meta-art-spinner" aria-hidden="true">
                <span className="game-meta-spinner-ring" />
              </div>
            ) : null}

            {displayedImageUrl ? (
              <img
                src={displayedImageUrl}
                alt={`${record?.canonicalTitle || selectedGame.gameName} box art`}
                className="game-meta-art-image"
                loading="lazy"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
            ) : (
              <div className="game-meta-art-empty">No box image yet</div>
            )}
          </div>

          <div className="game-meta-info">
            {loading ? <div className="game-meta-note">Loading stored metadata...</div> : null}
            {error ? <div className="game-meta-error">Failed to load metadata: {error}</div> : null}

            {!loading && !error && !record ? (
              <div className="game-meta-empty">
                <div className="game-meta-note">No stored metadata found for this game.</div>
                {lookupError ? <div className="game-meta-error">{lookupError}</div> : null}
              </div>
            ) : null}

            {!loading && record ? (
              <>
                {manualMode ? (
                  <>
                    <div className="game-meta-grid game-meta-grid-edit">
                      <label className="game-meta-inline-field">
                        <span>Title</span>
                        <input
                          type="text"
                          value={manualDraft.canonicalTitle}
                          onChange={(e) => onManualFieldChange("canonicalTitle", e.target.value)}
                        />
                      </label>
                      <label className="game-meta-inline-field">
                        <span>Year</span>
                        <input
                          type="text"
                          value={manualDraft.year}
                          onChange={(e) => onManualFieldChange("year", e.target.value)}
                        />
                      </label>
                      <label className="game-meta-inline-field">
                        <span>Players</span>
                        <input
                          type="text"
                          value={manualDraft.players}
                          onChange={(e) => onManualFieldChange("players", e.target.value)}
                        />
                      </label>
                      <label className="game-meta-inline-field">
                        <span>Genre</span>
                        <input
                          type="text"
                          value={manualDraft.genre}
                          onChange={(e) => onManualFieldChange("genre", e.target.value)}
                        />
                      </label>
                      <label className="game-meta-inline-field">
                        <span>Developer</span>
                        <input
                          type="text"
                          value={manualDraft.developer}
                          onChange={(e) => onManualFieldChange("developer", e.target.value)}
                        />
                      </label>
                      <label className="game-meta-inline-field">
                        <span>Publisher</span>
                        <input
                          type="text"
                          value={manualDraft.publisher}
                          onChange={(e) => onManualFieldChange("publisher", e.target.value)}
                        />
                      </label>
                      <div className="game-meta-inline-readonly">
                        <strong>Provider:</strong> {displayValue(record.source?.provider)}
                      </div>
                      <div className="game-meta-inline-readonly">
                        <strong>Status:</strong> {displayValue(record.source?.status)}
                      </div>
                    </div>

                    <label className="game-meta-inline-field game-meta-inline-field-full">
                      <span>Description</span>
                      <textarea
                        className="game-meta-description-input"
                        rows={5}
                        value={manualDraft.description}
                        onChange={(e) => onManualFieldChange("description", e.target.value)}
                      />
                    </label>

                    <label className="game-meta-inline-field game-meta-inline-field-full">
                      <span>Upload Box Art</span>
                      <input type="file" accept="image/*" onChange={onManualImageChange} />
                      {manualImageName ? (
                        <span className="game-meta-note">
                          Selected: {manualImageName}{" "}
                          <button
                            type="button"
                            className="game-meta-inline-btn"
                            onClick={() => {
                              setManualImageName("");
                              setManualImagePreview(null);
                              setManualDraft((prev) => ({ ...prev, boxFront: record?.images?.boxFront || "" }));
                            }}
                          >
                            Clear upload
                          </button>
                        </span>
                      ) : null}
                    </label>

                    <div className="game-meta-manual-actions">
                      <button
                        type="button"
                        className="game-meta-fetch-btn"
                        onClick={saveManualMetadata}
                        disabled={manualSaving}
                      >
                        {manualSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        className="game-meta-panel-close"
                        onClick={resetManualEditor}
                        disabled={manualSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="game-meta-grid">
                      <div><strong>Title:</strong> {displayValue(record.canonicalTitle || record.gameName)}</div>
                      <div><strong>Year:</strong> {displayValue(record.year)}</div>
                      <div><strong>Players:</strong> {displayValue(record.players)}</div>
                      <div><strong>Genre:</strong> {displayValue(record.genre)}</div>
                      <div><strong>Developer:</strong> {displayValue(record.developer)}</div>
                      <div><strong>Publisher:</strong> {displayValue(record.publisher)}</div>
                      <div><strong>Provider:</strong> {displayValue(record.source?.provider)}</div>
                      <div><strong>Status:</strong> {displayValue(record.source?.status)}</div>
                    </div>

                    {!hasMetadataContent(record) ? (
                      <div className="game-meta-actions">
                        <span className="game-meta-note">Stored record is empty/placeholder.</span>
                      </div>
                    ) : null}

                    <div className="game-meta-description">
                      {record.description ? record.description : "No description available yet."}
                    </div>
                  </>
                )}

                {lookupError ? <div className="game-meta-error">{lookupError}</div> : null}
              </>
            ) : null}

            {manualMode && !record ? (
              <div className="game-meta-manual-form">
                <div className="game-meta-manual-title">Manual Metadata Editor</div>

                <label className="game-meta-field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={manualDraft.canonicalTitle}
                    onChange={(e) => onManualFieldChange("canonicalTitle", e.target.value)}
                  />
                </label>

                <label className="game-meta-field">
                  <span>Year</span>
                  <input
                    type="text"
                    value={manualDraft.year}
                    onChange={(e) => onManualFieldChange("year", e.target.value)}
                  />
                </label>

                <label className="game-meta-field">
                  <span>Players</span>
                  <input
                    type="text"
                    value={manualDraft.players}
                    onChange={(e) => onManualFieldChange("players", e.target.value)}
                  />
                </label>

                <label className="game-meta-field">
                  <span>Genre</span>
                  <input
                    type="text"
                    value={manualDraft.genre}
                    onChange={(e) => onManualFieldChange("genre", e.target.value)}
                  />
                </label>

                <label className="game-meta-field">
                  <span>Developer</span>
                  <input
                    type="text"
                    value={manualDraft.developer}
                    onChange={(e) => onManualFieldChange("developer", e.target.value)}
                  />
                </label>

                <label className="game-meta-field">
                  <span>Publisher</span>
                  <input
                    type="text"
                    value={manualDraft.publisher}
                    onChange={(e) => onManualFieldChange("publisher", e.target.value)}
                  />
                </label>

                <label className="game-meta-field game-meta-field-full">
                  <span>Description</span>
                  <textarea
                    rows={5}
                    value={manualDraft.description}
                    onChange={(e) => onManualFieldChange("description", e.target.value)}
                  />
                </label>

                <label className="game-meta-field game-meta-field-full">
                  <span>Box Art URL (optional if uploading)</span>
                  <input
                    type="text"
                    placeholder="https://..."
                    disabled={Boolean(manualImagePreview)}
                    value={
                      manualDraft.boxFront && !String(manualDraft.boxFront).startsWith("data:")
                        ? manualDraft.boxFront
                        : ""
                    }
                    onChange={(e) => onManualFieldChange("boxFront", e.target.value)}
                  />
                </label>

                <label className="game-meta-field game-meta-field-full">
                  <span>Upload Box Art</span>
                  <input type="file" accept="image/*" onChange={onManualImageChange} />
                  {manualImageName ? (
                    <span className="game-meta-note">
                      Selected: {manualImageName}{" "}
                      <button
                        type="button"
                        className="game-meta-inline-btn"
                        onClick={() => {
                          setManualImageName("");
                          setManualImagePreview(null);
                          setManualDraft((prev) => ({ ...prev, boxFront: record?.images?.boxFront || "" }));
                        }}
                      >
                        Clear upload
                      </button>
                    </span>
                  ) : null}
                </label>

                <div className="game-meta-manual-actions">
                  <button
                    type="button"
                    className="game-meta-fetch-btn"
                    onClick={saveManualMetadata}
                    disabled={manualSaving}
                  >
                    {manualSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="game-meta-panel-close"
                    onClick={resetManualEditor}
                    disabled={manualSaving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

GameMetadataPanel.propTypes = {
  selectedGame: PropTypes.shape({
    selectionKey: PropTypes.string.isRequired,
    diskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    side: PropTypes.string.isRequired,
    sideLabel: PropTypes.string.isRequired,
    gameIndex: PropTypes.number.isRequired,
    gameName: PropTypes.string.isRequired,
  }),
  lookupProvider: PropTypes.string,
  onLookupProviderChange: PropTypes.func,
  onClose: PropTypes.func,
  onNotify: PropTypes.func,
  mobileRouteMode: PropTypes.bool,
  closing: PropTypes.bool,
};
