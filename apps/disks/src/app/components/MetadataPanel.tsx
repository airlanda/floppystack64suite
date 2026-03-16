import { useEffect, useState } from 'react';
import { Fs64MetadataProvider, Fs64MetadataRecord, fetchMetadataRecord, lookupMetadataRecord } from '@fs64/domain';

type SelectedGame = {
  selectionKey: string;
  diskId: string;
  side: 'sideA' | 'sideB';
  sideLabel: string;
  gameIndex: number;
  gameName: string;
};

type MetadataPanelProps = {
  selectedGame: SelectedGame;
  onClose: () => void;
};

export function MetadataPanel({ selectedGame, onClose }: MetadataPanelProps) {
  const [record, setRecord] = useState<Fs64MetadataRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupProvider, setLookupProvider] = useState<Fs64MetadataProvider>('thegamesdb');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setLookupError(null);
      try {
        const nextRecord = await fetchMetadataRecord(selectedGame.gameName);
        if (!cancelled) setRecord(nextRecord);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load metadata');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedGame.selectionKey, selectedGame.gameName]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function requestLookup() {
    if (lookupLoading) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const nextRecord = await lookupMetadataRecord({
        gameName: selectedGame.gameName,
        provider: lookupProvider,
        persist: true,
        downloadImages: true,
      });
      setRecord(nextRecord);
    } catch (lookupFailure) {
      setLookupError(lookupFailure instanceof Error ? lookupFailure.message : 'Metadata lookup failed');
    } finally {
      setLookupLoading(false);
    }
  }

  const imageUrl = record?.images?.boxFront || record?.images?.screenshot || record?.images?.logo;
  const providerLabel = lookupProvider === 'thegamesdb' ? 'TheGamesDB' : 'Hybrid';

  return (
    <div className="game-meta-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="game-meta-panel" onClick={(event) => event.stopPropagation()}>
        <div className="game-meta-header">
          <div className="game-meta-appbar">
            <div className="game-meta-appbar-title">Game Data</div>
            <div className="game-meta-appbar-actions">
              <button
                type="button"
                className="game-meta-toolbar-btn"
                onClick={requestLookup}
                disabled={lookupLoading}
                title={lookupLoading ? 'Refreshing metadata...' : 'Refresh metadata'}
                aria-label={lookupLoading ? 'Refreshing metadata' : 'Refresh metadata'}
              >
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                  <path d="M8 2a6 6 0 1 0 5.2 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M10.8 1.7H14v3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M14 1.7 11.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
              <button type="button" className="game-meta-close" onClick={onClose} aria-label="Close metadata panel">
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
            </div>
          </div>
          <div className="game-meta-title-row">
            <div className="game-meta-kicker">Game on Disk</div>
            <h3>{record?.canonicalTitle || record?.gameName || selectedGame.gameName}</h3>
          </div>
          <div className="game-meta-subtitle-row">
            <div className="game-meta-panel-subtitle">
              Disk {selectedGame.diskId} | {selectedGame.sideLabel}
            </div>
            <div className="game-meta-provider-row" role="group" aria-label="Metadata provider">
              <span className="game-meta-provider-label">Provider</span>
              <div className="game-meta-provider-toggle">
                <button
                  type="button"
                  className={`game-meta-provider-chip${lookupProvider === 'thegamesdb' ? ' is-active' : ''}`}
                  onClick={() => setLookupProvider('thegamesdb')}
                  aria-pressed={lookupProvider === 'thegamesdb'}
                >
                  TheGamesDB
                </button>
                <button
                  type="button"
                  className={`game-meta-provider-chip${lookupProvider === 'hybrid' ? ' is-active' : ''}`}
                  onClick={() => setLookupProvider('hybrid')}
                  aria-pressed={lookupProvider === 'hybrid'}
                >
                  Hybrid
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? <div className="game-meta-message">Loading metadata...</div> : null}
        {error ? <div className="game-meta-message game-meta-error">{error}</div> : null}
        {lookupError ? <div className="game-meta-message game-meta-error">{lookupError}</div> : null}

        {!loading && !error ? (
          <div className="game-meta-body">
            <div className="game-meta-art">
              {imageUrl ? <img className="game-meta-art-image" src={imageUrl} alt={selectedGame.gameName} /> : <div className="game-meta-art-empty">No image</div>}
            </div>
            <div className="game-meta-fields">
              <Field label="Game on Disk" value={selectedGame.gameName} />
              <Field label="Canonical Title" value={record?.canonicalTitle || 'Unknown'} />
              <Field label="Genre" value={record?.genre || 'Unknown'} />
              <Field label="Developer" value={record?.developer || 'Unknown'} />
              <Field label="Publisher" value={record?.publisher || 'Unknown'} />
              <Field label="Year" value={record?.year || 'Unknown'} />
              <Field label="Players" value={record?.players || 'Unknown'} />
              <Field label="Provider" value={providerLabel} />
              <Field label="Description" value={record?.description || 'No description available.'} multiline />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={`game-meta-field${multiline ? ' is-multiline' : ''}`}>
      <div className="game-meta-field-label">{label}</div>
      <div className="game-meta-field-value">{value}</div>
    </div>
  );
}
