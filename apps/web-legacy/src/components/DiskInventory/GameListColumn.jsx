import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ListGroup, ListGroupItem } from "reactstrap";
import RatingStars from "./RatingStars.jsx";

export default function GameListColumn({
  title,
  games,
  sideKey,
  diskId,
  datasetKey,
  onRateGame,
  onSelectGame,
  ratingSaveMap,
  mobileRatingMode = false,
  activeMobileEditorKey = null,
  onSetActiveMobileEditorKey,
  onSaveGameTitles,
  randomChallengeTarget,
}) {
  const list = Array.isArray(games) ? games : [];
  const [draftRatings, setDraftRatings] = useState({});
  const [titleEditMode, setTitleEditMode] = useState(false);
  const [draftTitles, setDraftTitles] = useState([]);
  const [savingTitles, setSavingTitles] = useState(false);

  useEffect(() => {
    if (!mobileRatingMode) {
      setDraftRatings({});
    }
  }, [mobileRatingMode]);

  useEffect(() => {
    if (!titleEditMode) return;
    setDraftTitles(
      list.map((game) => (game && typeof game === "object" ? game.gameName : String(game || "")))
    );
  }, [list, titleEditMode]);

  const setDraftValue = (key, nextValue) => {
    const clamped = Math.max(0, Math.min(5, Math.round(Number(nextValue || 0) * 2) / 2));
    setDraftRatings((prev) => ({ ...prev, [key]: clamped }));
  };

  const beginTitleEdit = () => {
    setDraftTitles(list.map((game) => (game && typeof game === "object" ? game.gameName : String(game || ""))));
    setTitleEditMode(true);
  };

  const cancelTitleEdit = () => {
    setDraftTitles([]);
    setTitleEditMode(false);
    setSavingTitles(false);
  };

  const saveTitleEdit = async () => {
    if (!onSaveGameTitles || savingTitles) return;
    setSavingTitles(true);
    try {
      const cleaned = draftTitles.map((title) => String(title || "").trim()).filter(Boolean);
      if (cleaned.length !== list.length) {
        throw new Error("Every game title must be filled in before saving.");
      }
      await onSaveGameTitles({
        dataset: datasetKey || "default",
        diskId,
        side: sideKey,
        titles: draftTitles.map((title) => String(title || "").trim()),
      });
      setTitleEditMode(false);
    } catch (error) {
      console.error("Failed to save titles:", error);
    } finally {
      setSavingTitles(false);
    }
  };

  return (
    <div className="c64-side">
      <div className="c64-side-title c64-side-title-row">
        <span>{title}</span>
        <span className="c64-side-title-actions">
          {!titleEditMode ? (
            <button
              type="button"
              className="c64-side-icon-btn c64-side-edit-btn"
              onClick={beginTitleEdit}
              title={`Edit ${title} titles`}
              aria-label={`Edit ${title} titles`}
            >
              <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                {/* Vintage pixel edit icon: note + diagonal pencil */}
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
          ) : (
            <>
              <button
                type="button"
                className="c64-side-icon-btn"
                onClick={saveTitleEdit}
                disabled={savingTitles}
                title="Save title edits"
                aria-label="Save title edits"
              >
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                  <rect x="2.5" y="1.5" width="11" height="13" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="4" y="3.5" width="8" height="2.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="4" y1="7.5" x2="12" y2="7.5" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="5" y="10" width="6" height="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
              <button
                type="button"
                className="c64-side-icon-btn"
                onClick={cancelTitleEdit}
                disabled={savingTitles}
                title="Cancel title edits"
                aria-label="Cancel title edits"
              >
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                  <rect x="3" y="2" width="2" height="2" />
                  <rect x="5" y="4" width="2" height="2" />
                  <rect x="7" y="6" width="2" height="2" />
                  <rect x="9" y="8" width="2" height="2" />
                  <rect x="11" y="10" width="2" height="2" />
                  <rect x="11" y="2" width="2" height="2" />
                  <rect x="9" y="4" width="2" height="2" />
                  <rect x="7" y="8" width="2" height="2" />
                  <rect x="5" y="10" width="2" height="2" />
                  <rect x="3" y="12" width="2" height="2" />
                </svg>
              </button>
            </>
          )}
        </span>
      </div>

      <div className="c64-listwrap">
        <ListGroup>
          {list.map((game, index) => {
            const gameName = game && typeof game === "object" ? game.gameName : game;
            const rating = game && typeof game === "object" ? game.rating : null;
            const ratingKey = `${diskId}|${sideKey}|${index}|${String(gameName)}`;
            const numericRating =
              rating == null || Number.isNaN(Number(rating)) ? 0 : Number(rating);
            const isSaving = Boolean(ratingSaveMap?.[ratingKey]);
            const isEditingMobile = mobileRatingMode && activeMobileEditorKey === ratingKey;
            const draftRating =
              draftRatings[ratingKey] == null ? numericRating : Number(draftRatings[ratingKey]);
            const isChallengeGame =
              randomChallengeTarget &&
              String(randomChallengeTarget.diskId) === String(diskId) &&
              randomChallengeTarget.side === sideKey &&
              Number(randomChallengeTarget.gameIndex) === Number(index);

            return (
              <ListGroupItem
                key={`${sideKey}-${diskId}-${String(gameName)}-${index}`}
                className={`c64-item${isChallengeGame ? " c64-item-challenge" : ""}`}
              >
                <span className="c64-item-text c64-item-content">
                  <span className="c64-item-row-top">
                    {titleEditMode ? (
                      <input
                        type="text"
                        className="c64-title-edit-input"
                        value={draftTitles[index] ?? gameName}
                        onChange={(e) => {
                          const next = [...draftTitles];
                          next[index] = e.target.value;
                          setDraftTitles(next);
                        }}
                        disabled={savingTitles}
                      />
                    ) : (
                      <button
                        type="button"
                        className="c64-item-name-btn"
                        onClick={() =>
                          onSelectGame?.({
                            diskId,
                            side: sideKey,
                            gameIndex: index,
                            gameName,
                          })
                        }
                      >
                        <span className="c64-item-name">{gameName}</span>
                      </button>
                    )}
                  </span>
                  {!titleEditMode
                    ? mobileRatingMode ? (
                        <>
                          <button
                            type="button"
                            className="rating-mobile-trigger"
                            onClick={() =>
                              onSetActiveMobileEditorKey?.(
                                activeMobileEditorKey === ratingKey ? null : ratingKey
                              )
                            }
                            aria-expanded={isEditingMobile}
                            aria-label={`Edit rating for ${gameName}`}
                          >
                            <RatingStars rating={numericRating} />
                          </button>

                          {isEditingMobile && (
                            <div className="rating-mobile-editor" role="group" aria-label={`Rate ${gameName}`}>
                              <div className="rating-mobile-editor-preview">
                                <RatingStars
                                  rating={draftRating}
                                  className="rating-mobile-preview-stars"
                                />
                              </div>

                              <div className="rating-mobile-editor-slider-wrap">
                                <input
                                  type="range"
                                  className="rating-mobile-slider"
                                  min="0"
                                  max="5"
                                  step="0.5"
                                  value={draftRating}
                                  disabled={isSaving}
                                  onChange={(e) => setDraftValue(ratingKey, e.target.value)}
                                  aria-label={`Rating slider for ${gameName}`}
                                />
                              </div>

                              <div className="rating-mobile-editor-actions">
                                <button
                                  type="button"
                                  className="rating-action-btn"
                                  onClick={() => {
                                    setDraftRatings((prev) => ({ ...prev, [ratingKey]: numericRating }));
                                    onSetActiveMobileEditorKey?.(null);
                                  }}
                                  disabled={isSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="rating-action-btn is-primary"
                                  onClick={() => {
                                    onRateGame?.({
                                      dataset: datasetKey || "default",
                                      diskId,
                                      side: sideKey,
                                      gameIndex: index,
                                      gameName,
                                      rating: draftRating,
                                      previousRating: rating ?? null,
                                    });
                                    onSetActiveMobileEditorKey?.(null);
                                  }}
                                  disabled={isSaving}
                                >
                                  {isSaving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <RatingStars
                          rating={numericRating}
                          editable
                          isSaving={isSaving}
                          onChange={(nextRating) =>
                            onRateGame?.({
                              dataset: datasetKey || "default",
                              diskId,
                              side: sideKey,
                              gameIndex: index,
                              gameName,
                              rating: nextRating,
                              previousRating: rating ?? null,
                            })
                          }
                        />
                      )
                    : null}
                </span>
              </ListGroupItem>
            );
          })}
        </ListGroup>
      </div>
    </div>
  );
}

GameListColumn.propTypes = {
  title: PropTypes.string.isRequired,
  games: PropTypes.array,
  sideKey: PropTypes.string.isRequired,
  diskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  datasetKey: PropTypes.string,
  onRateGame: PropTypes.func,
  onSelectGame: PropTypes.func,
  ratingSaveMap: PropTypes.object,
  mobileRatingMode: PropTypes.bool,
  activeMobileEditorKey: PropTypes.string,
  onSetActiveMobileEditorKey: PropTypes.func,
  onSaveGameTitles: PropTypes.func,
  randomChallengeTarget: PropTypes.shape({
    diskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    side: PropTypes.string,
    gameIndex: PropTypes.number,
    gameName: PropTypes.string,
  }),
};
