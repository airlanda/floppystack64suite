import React, { useEffect, useRef, useState } from "react";
import { DropdownItem, DropdownMenu, DropdownToggle, UncontrolledDropdown } from "reactstrap";
import Floppy from "../Floppy.jsx";
import "../DiskInventory/DiskInventory.css";
import "./GameFinderPage.css";

function makeQueryUrl(query) {
  const url = new URL("/api/games/search", window.location.origin);
  if (query.trim()) url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "500");
  return `${url.pathname}${url.search}`;
}

function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function MiniDiskBadge({ location }) {
  const datasetLabel = location.datasetKey ? ` [${location.datasetKey}]` : "";
  return (
    <div
      className="gf-disk-badge"
      title={`Disk ${location.diskId}${datasetLabel} ${location.sideLabel} | Slot ${location.slot}`}
    >
      <div className="gf-disk-art">
        <Floppy className="gf-disk-svg" title={`Disk ${location.diskId}`} />
        <div className="gf-disk-number">{`${location.diskId}${location.sideLabel}`}</div>
      </div>
    </div>
  );
}

export default function GameFinderPage({ searchQuery = "" }) {
  const debouncedQuery = useDebouncedValue(searchQuery, 220);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [metadataLookupProvider, setMetadataLookupProvider] = useState("thegamesdb");
  const [inlineLookupLoading, setInlineLookupLoading] = useState(false);
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [inlineManualSaving, setInlineManualSaving] = useState(false);
  const [inlineImageName, setInlineImageName] = useState("");
  const [inlineDraft, setInlineDraft] = useState({
    canonicalTitle: "",
    year: "",
    players: "",
    genre: "",
    publisher: "",
    developer: "",
    description: "",
    boxFront: "",
  });
  const [snackbars, setSnackbars] = useState([]);
  const snackbarTimers = useRef(new Map());

  useEffect(() => {
    return () => {
      snackbarTimers.current.forEach((timerId) => clearTimeout(timerId));
      snackbarTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadGames() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(makeQueryUrl(debouncedQuery));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (cancelled) return;
        const nextResults = Array.isArray(payload?.results) ? payload.results : [];
        setResults(nextResults);
        setCurrentIndex(0);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load games");
        setResults([]);
        setCurrentIndex(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGames();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const current = results[currentIndex] || null;
  const imageUrl = current?.metadata?.images?.boxFront || current?.metadata?.images?.screenshot || null;
  const displayTitle = current?.metadata?.canonicalTitle || current?.gameName || "";
  const gameCounterLabel = results.length ? `${currentIndex + 1}/${results.length}` : "0/0";

  useEffect(() => {
    setInlineEditMode(false);
    setInlineImageName("");
    setInlineDraft({
      canonicalTitle: current?.metadata?.canonicalTitle || current?.gameName || "",
      year: current?.metadata?.year || "",
      players: current?.metadata?.players || "",
      genre: current?.metadata?.genre || "",
      publisher: current?.metadata?.publisher || "",
      developer: current?.metadata?.developer || "",
      description: current?.metadata?.description || "",
      boxFront: current?.metadata?.images?.boxFront || "",
    });
  }, [current?.key]);

  const goPrev = () => {
    if (!results.length) return;
    setCurrentIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
  };

  const goNext = () => {
    if (!results.length) return;
    setCurrentIndex((prev) => (prev >= results.length - 1 ? 0 : prev + 1));
  };

  const onTouchStart = (e) => {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchEnd = (e) => {
    if (!touchStart) return;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    setTouchStart(null);
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) {
      if (dx > 0) goPrev();
      else goNext();
    }
  };

  const dismissSnackbar = (id) => {
    const timerId = snackbarTimers.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      snackbarTimers.current.delete(id);
    }
    setSnackbars((prev) => prev.filter((snackbar) => snackbar.id !== id));
  };

  const pushSnackbar = ({ message, tone = "info" }) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSnackbars((prev) => [...prev, { id, message, tone }]);
    const timerId = window.setTimeout(() => dismissSnackbar(id), 2800);
    snackbarTimers.current.set(id, timerId);
  };

  const patchCurrentMetadataInResults = (requestKey, nextRecord) => {
    if (!nextRecord) return;
    setResults((prev) =>
      prev.map((entry) =>
        entry.key === requestKey
          ? {
              ...entry,
              metadata: {
                ...(entry.metadata || {}),
                canonicalTitle: nextRecord.canonicalTitle || entry.gameName,
                description: nextRecord.description || null,
                genre: nextRecord.genre || null,
                developer: nextRecord.developer || null,
                publisher: nextRecord.publisher || null,
                year: nextRecord.year || null,
                players: nextRecord.players || null,
                images: nextRecord.images || {},
                source: nextRecord.source || null,
                updatedAt: nextRecord.updatedAt || null,
              },
            }
          : entry
      )
    );
  };

  const requestMetadataForCurrent = async () => {
    if (!current?.gameName || inlineLookupLoading) return;
    const requestKey = current.key;
    const requestName = current.gameName;
    const hadMetadata = Boolean(current.metadata?.source?.status);

    setInlineLookupLoading(true);
    try {
      const response = await fetch("/api/metadata/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameName: current.gameName,
          provider: metadataLookupProvider,
          persist: true,
          downloadImages: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      const found = Boolean(payload?.found ?? payload?.result?.found);
      const nextRecord = payload?.stored || payload?.result || null;
      patchCurrentMetadataInResults(requestKey, nextRecord);

      pushSnackbar({
        message: found
          ? `Metadata ${hadMetadata ? "refreshed" : "fetched"} for ${requestName}`
          : `No metadata found for ${requestName}`,
        tone: found ? "success" : "warning",
      });
    } catch (err) {
      pushSnackbar({
        message: `Metadata lookup failed for ${requestName}: ${err.message || "Unknown error"}`,
        tone: "error",
      });
    } finally {
      setInlineLookupLoading(false);
    }
  };

  const saveInlineMetadataForCurrent = async () => {
    if (!current?.gameName || inlineManualSaving) return;
    const requestKey = current.key;
    const requestName = current.gameName;
    setInlineManualSaving(true);
    try {
      const response = await fetch("/api/metadata/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameName: requestName,
          platform: "c64",
          metadata: {
            canonicalTitle: inlineDraft.canonicalTitle,
            description: inlineDraft.description,
            genre: inlineDraft.genre,
            developer: inlineDraft.developer,
            publisher: inlineDraft.publisher,
            year: inlineDraft.year,
            players: inlineDraft.players,
          },
          images: {
            boxFront:
              inlineDraft.boxFront && !String(inlineDraft.boxFront).startsWith("data:")
                ? inlineDraft.boxFront
                : undefined,
          },
          uploads:
            inlineDraft.boxFront && String(inlineDraft.boxFront).startsWith("data:")
              ? {
                  boxFront: {
                    dataUrl: inlineDraft.boxFront,
                    fileName: inlineImageName || "boxfront-upload",
                  },
                }
              : {},
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      patchCurrentMetadataInResults(requestKey, payload?.stored || null);
      setInlineEditMode(false);
      setInlineImageName("");
      pushSnackbar({ message: `Manual metadata saved for ${requestName}`, tone: "success" });
    } catch (err) {
      pushSnackbar({
        message: `Manual save failed for ${requestName}: ${err.message || "Unknown error"}`,
        tone: "error",
      });
    } finally {
      setInlineManualSaving(false);
    }
  };

  const onInlineImageChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      pushSnackbar({ message: "Please choose an image file", tone: "warning" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        pushSnackbar({ message: "Failed to read selected image", tone: "error" });
        return;
      }
      setInlineImageName(file.name || "uploaded-image");
      setInlineDraft((prev) => ({ ...prev, boxFront: dataUrl }));
    };
    reader.onerror = () => pushSnackbar({ message: "Failed to read selected image", tone: "error" });
    reader.readAsDataURL(file);
  };

  return (
    <section className="gf-root">
      <div className="gf-container">
        <div className="gf-carousel-shell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button type="button" className="gf-nav-btn gf-nav-left" onClick={goPrev} disabled={!results.length} aria-label="Previous game">
            <span>&#9664;</span>
          </button>

          <div className="gf-card">
            {!loading && !error && !current ? (
              <div className="gf-empty">No matching games.</div>
            ) : null}

            {current ? (
              <>
                <div className="gf-card-top-header">
                  <div className="gf-modalish-header">
                    <div className="gf-modalish-appbar" role="toolbar" aria-label="Metadata actions">
                      <div className="gf-modalish-appbar-title">{gameCounterLabel}</div>
                    </div>

                    <div className="gf-modalish-title-strip">
                      <div className="gf-modalish-title-row">{current.gameName}</div>
                      <button
                        type="button"
                        className={`gf-modalish-icon-btn gf-modalish-edit-btn gf-modalish-edit-inline${inlineEditMode ? " is-active" : ""}`}
                        onClick={() => setInlineEditMode((prev) => !prev)}
                        title={inlineEditMode ? "Close metadata editor" : "Edit metadata"}
                        aria-label={inlineEditMode ? "Close metadata editor" : "Edit metadata"}
                        aria-pressed={inlineEditMode}
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
                    </div>

                    <div className="gf-modalish-provider-row">
                      <span className="gf-modalish-provider-label">Provider</span>
                      <UncontrolledDropdown className="gf-modalish-provider-dropdown">
                        <DropdownToggle
                          color="dark"
                          caret
                          className="gf-modalish-provider-toggle"
                          title="Metadata provider"
                          aria-label={`Metadata provider: ${metadataLookupProvider === "thegamesdb" ? "TheGamesDB" : "Hybrid"}`}
                        >
                          {metadataLookupProvider === "thegamesdb" ? "TheGamesDB" : "Hybrid"}
                        </DropdownToggle>
                        <DropdownMenu end className="gf-modalish-provider-menu">
                          <DropdownItem
                            className="gf-modalish-provider-item"
                            active={metadataLookupProvider === "thegamesdb"}
                            onClick={() => setMetadataLookupProvider("thegamesdb")}
                          >
                            TheGamesDB
                          </DropdownItem>
                          <DropdownItem
                            className="gf-modalish-provider-item"
                            active={metadataLookupProvider === "hybrid"}
                            onClick={() => setMetadataLookupProvider("hybrid")}
                          >
                            Hybrid
                          </DropdownItem>
                        </DropdownMenu>
                      </UncontrolledDropdown>

                      <button
                        type="button"
                        className="gf-modalish-icon-btn gf-modalish-provider-refresh-btn"
                        onClick={requestMetadataForCurrent}
                        disabled={inlineLookupLoading}
                        title={
                          inlineLookupLoading
                            ? "Fetching metadata..."
                            : current.metadata?.source?.status
                              ? "Refresh metadata"
                              : "Fetch metadata"
                        }
                        aria-label={
                          inlineLookupLoading
                            ? "Fetching metadata"
                            : current.metadata?.source?.status
                              ? "Refresh metadata"
                              : "Fetch metadata"
                        }
                      >
                        <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                          <path d="M8 2a6 6 0 1 0 5.2 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M10.8 1.7H14v3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M14 1.7 11.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="gf-card-art">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`${displayTitle} box art`}
                      className="gf-card-art-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="gf-card-art-empty">No box art</div>
                  )}
                </div>

                <div className="gf-card-body">
                  <div className="gf-locations gf-locations-top">
                    <div className="gf-locations-list">
                      {current.locations.map((location) => (
                        <MiniDiskBadge
                          key={`${location.diskId}-${location.side}-${location.slot}`}
                          location={location}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="gf-card-meta-grid">
                    <div><strong>Title:</strong> {displayTitle || "Unknown"}</div>
                    <div><strong>Year:</strong> {current.metadata?.year || "Unknown"}</div>
                    <div><strong>Players:</strong> {current.metadata?.players || "Unknown"}</div>
                    <div><strong>Genre:</strong> {current.metadata?.genre || "Unknown"}</div>
                    <div><strong>Publisher:</strong> {current.metadata?.publisher || "Unknown"}</div>
                    <div><strong>Developer:</strong> {current.metadata?.developer || "Unknown"}</div>
                    <div><strong>Source:</strong> {current.metadata?.source?.provider || "none"}</div>
                  </div>

                  {inlineEditMode ? (
                    <div className="gf-inline-editor">
                      <div className="gf-inline-editor-grid">
                        <label>
                          <span>Title</span>
                          <input
                            type="text"
                            value={inlineDraft.canonicalTitle}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, canonicalTitle: e.target.value }))}
                          />
                        </label>
                        <label>
                          <span>Year</span>
                          <input
                            type="text"
                            value={inlineDraft.year}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, year: e.target.value }))}
                          />
                        </label>
                        <label>
                          <span>Players</span>
                          <input
                            type="text"
                            value={inlineDraft.players}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, players: e.target.value }))}
                          />
                        </label>
                        <label>
                          <span>Genre</span>
                          <input
                            type="text"
                            value={inlineDraft.genre}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, genre: e.target.value }))}
                          />
                        </label>
                        <label>
                          <span>Publisher</span>
                          <input
                            type="text"
                            value={inlineDraft.publisher}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, publisher: e.target.value }))}
                          />
                        </label>
                        <label>
                          <span>Developer</span>
                          <input
                            type="text"
                            value={inlineDraft.developer}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, developer: e.target.value }))}
                          />
                        </label>
                        <label className="gf-inline-editor-full">
                          <span>Box Art URL</span>
                          <input
                            type="text"
                            placeholder="https://..."
                            value={inlineDraft.boxFront}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, boxFront: e.target.value }))}
                          />
                        </label>
                        <label className="gf-inline-editor-full">
                          <span>Upload Box Art</span>
                          <input type="file" accept="image/*" onChange={onInlineImageChange} />
                          {inlineImageName ? (
                            <span className="game-meta-note">
                              Selected: {inlineImageName}{" "}
                              <button
                                type="button"
                                className="game-meta-inline-btn"
                                onClick={() => {
                                  setInlineImageName("");
                                  setInlineDraft((prev) => ({
                                    ...prev,
                                    boxFront: current?.metadata?.images?.boxFront || "",
                                  }));
                                }}
                              >
                                Clear upload
                              </button>
                            </span>
                          ) : null}
                        </label>
                        <label className="gf-inline-editor-full">
                          <span>Description</span>
                          <textarea
                            rows={4}
                            value={inlineDraft.description}
                            onChange={(e) => setInlineDraft((prev) => ({ ...prev, description: e.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="gf-inline-editor-actions">
                        <button
                          type="button"
                          className="gf-inline-fetch-btn"
                          onClick={saveInlineMetadataForCurrent}
                          disabled={inlineManualSaving}
                        >
                          {inlineManualSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="gf-inline-edit-btn"
                          onClick={() => {
                            setInlineEditMode(false);
                            setInlineImageName("");
                            setInlineDraft({
                              canonicalTitle: current?.metadata?.canonicalTitle || current?.gameName || "",
                              year: current?.metadata?.year || "",
                              players: current?.metadata?.players || "",
                              genre: current?.metadata?.genre || "",
                              publisher: current?.metadata?.publisher || "",
                              developer: current?.metadata?.developer || "",
                              description: current?.metadata?.description || "",
                              boxFront: current?.metadata?.images?.boxFront || "",
                            });
                          }}
                          disabled={inlineManualSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!inlineEditMode ? (
                    <div className="gf-card-description">
                      {current.metadata?.description || "No description available yet."}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <button type="button" className="gf-nav-btn gf-nav-right" onClick={goNext} disabled={!results.length} aria-label="Next game">
            <span>&#9654;</span>
          </button>
        </div>

        <div className="c64-snackbar-stack" aria-live="polite" aria-atomic="false">
          {snackbars.map((snackbar) => (
            <div key={snackbar.id} className={`c64-snackbar c64-snackbar-${snackbar.tone || "info"}`} role="status">
              <span>{snackbar.message}</span>
              <button
                type="button"
                className="c64-snackbar-close"
                onClick={() => dismissSnackbar(snackbar.id)}
                aria-label="Dismiss notification"
              >
                x
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

GameFinderPage.propTypes = {
  searchQuery: (props, propName, componentName) => {
    if (props[propName] == null) return null;
    if (typeof props[propName] !== "string") {
      return new Error(`${componentName}: ${propName} must be a string`);
    }
    return null;
  },
};
