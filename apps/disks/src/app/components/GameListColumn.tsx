import { useEffect, useState } from 'react';
import { Fs64Game, normalizeGameTitle } from '@fs64/domain';
import { RatingStars } from './RatingStars';

type SideKey = 'sideA' | 'sideB';

type GameListColumnProps = {
  title: string;
  games?: Array<string | Fs64Game>;
  sideKey: SideKey;
  diskId: string;
  datasetKey?: string;
  savingRatings: Record<string, boolean>;
  mobileRatingMode?: boolean;
  activeMobileEditorKey?: string | null;
  onSetActiveMobileEditorKey?: (key: string | null) => void;
  onRateGame: (payload: {
    dataset: string;
    diskId: string;
    side: SideKey;
    gameIndex: number;
    gameName: string;
    rating: number;
    previousRating: number | null;
  }) => void;
  onSelectGame: (payload: { diskId: string; side: SideKey; gameIndex: number; gameName: string }) => void;
  onSaveGameTitles: (payload: { dataset: string; diskId: string; side: SideKey; titles: string[] }) => Promise<void>;
};

export function GameListColumn({
  title,
  games = [],
  sideKey,
  diskId,
  datasetKey,
  savingRatings,
  mobileRatingMode = false,
  activeMobileEditorKey = null,
  onSetActiveMobileEditorKey,
  onRateGame,
  onSelectGame,
  onSaveGameTitles,
}: GameListColumnProps) {
  const [draftRatings, setDraftRatings] = useState<Record<string, number>>({});
  const [titleEditMode, setTitleEditMode] = useState(false);
  const [draftTitles, setDraftTitles] = useState<string[]>([]);
  const [savingTitles, setSavingTitles] = useState(false);

  useEffect(() => {
    if (!mobileRatingMode) {
      setDraftRatings({});
    }
  }, [mobileRatingMode]);

  useEffect(() => {
    if (!titleEditMode) return;
    setDraftTitles(games.map(normalizeGameTitle));
  }, [games, titleEditMode]);

  const setDraftValue = (key: string, nextValue: number | string) => {
    const clamped = Math.max(0, Math.min(5, Math.round(Number(nextValue || 0) * 2) / 2));
    setDraftRatings((prev) => ({ ...prev, [key]: clamped }));
  };

  async function saveTitleEdit() {
    if (savingTitles) return;
    setSavingTitles(true);
    try {
      const titles = draftTitles.map((value) => String(value || '').trim());
      await onSaveGameTitles({
        dataset: datasetKey || 'default',
        diskId,
        side: sideKey,
        titles,
      });
      setTitleEditMode(false);
    } finally {
      setSavingTitles(false);
    }
  }

  return (
    <section className="c64-side">
      <div className="c64-side-title c64-side-title-row">
        <span>{title}</span>
        <span className="c64-side-title-actions">
          {!titleEditMode ? (
            <button
              type="button"
              className="c64-side-icon-btn c64-side-edit-btn"
              onClick={() => setTitleEditMode(true)}
              aria-label={`Edit ${title} titles`}
              title={`Edit ${title} titles`}
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
                onClick={() => setTitleEditMode(false)}
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
        {games.map((game, index) => {
          const gameName = normalizeGameTitle(game);
          const numericRating = typeof game === 'string' ? 0 : Number(game?.rating || 0);
          const ratingKey = `${diskId}|${sideKey}|${index}|${gameName}`;
          const isEditingMobile = mobileRatingMode && activeMobileEditorKey === ratingKey;
          const draftRating = draftRatings[ratingKey] == null ? numericRating : Number(draftRatings[ratingKey]);

          return (
            <article key={ratingKey} className="c64-item">
              <div className="c64-item-text c64-item-content">
                <div className="c64-item-row-top">
                  {titleEditMode ? (
                    <input
                      type="text"
                      className="c64-title-edit-input"
                      value={draftTitles[index] ?? gameName}
                      onChange={(event) => {
                        const next = [...draftTitles];
                        next[index] = event.target.value;
                        setDraftTitles(next);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="c64-item-name-btn"
                      onClick={() => onSelectGame({ diskId, side: sideKey, gameIndex: index, gameName })}
                    >
                      <span className="c64-item-name">{gameName}</span>
                    </button>
                  )}
                </div>
                {!titleEditMode ? (
                  mobileRatingMode ? (
                    <>
                      <button
                        type="button"
                        className="rating-mobile-trigger"
                        onClick={() => onSetActiveMobileEditorKey?.(activeMobileEditorKey === ratingKey ? null : ratingKey)}
                        aria-expanded={isEditingMobile}
                        aria-label={`Edit rating for ${gameName}`}
                      >
                        <RatingStars rating={numericRating} />
                      </button>

                      {isEditingMobile ? (
                        <div className="rating-mobile-editor" role="group" aria-label={`Rate ${gameName}`}>
                          <div className="rating-mobile-editor-preview">
                            <RatingStars rating={draftRating} className="rating-mobile-preview-stars" />
                          </div>
                          <div className="rating-mobile-editor-slider-wrap">
                            <input
                              type="range"
                              className="rating-mobile-slider"
                              min="0"
                              max="5"
                              step="0.5"
                              value={draftRating}
                              disabled={Boolean(savingRatings[ratingKey])}
                              onChange={(event) => setDraftValue(ratingKey, event.target.value)}
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
                              disabled={Boolean(savingRatings[ratingKey])}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="rating-action-btn is-primary"
                              onClick={() => {
                                onRateGame({
                                  dataset: datasetKey || 'default',
                                  diskId,
                                  side: sideKey,
                                  gameIndex: index,
                                  gameName,
                                  rating: draftRating,
                                  previousRating: Number.isFinite(numericRating) ? numericRating : null,
                                });
                                onSetActiveMobileEditorKey?.(null);
                              }}
                              disabled={Boolean(savingRatings[ratingKey])}
                            >
                              {savingRatings[ratingKey] ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <RatingStars
                      rating={numericRating}
                      editable
                      isSaving={Boolean(savingRatings[ratingKey])}
                      onChange={(nextRating) =>
                        onRateGame({
                          dataset: datasetKey || 'default',
                          diskId,
                          side: sideKey,
                          gameIndex: index,
                          gameName,
                          rating: nextRating,
                          previousRating: Number.isFinite(numericRating) ? numericRating : null,
                        })
                      }
                    />
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
