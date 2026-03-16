import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Fs64GameSearchResult, searchGames } from '@fs64/domain';
import { Fs64ThemeName, getFs64Theme, readStoredFs64Theme, resolveFs64ThemeName } from '@fs64/theme';
import { MetadataPanel } from './components/MetadataPanel';
import './games.css';

type SelectedGame = {
  selectionKey: string;
  gameName: string;
  canonicalTitle?: string | null;
  diskId: string;
  sideLabel: string;
};

export function App() {
  const [themeName, setThemeName] = useState<Fs64ThemeName>(() => readStoredFs64Theme());
  const theme = getFs64Theme(themeName);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [results, setResults] = useState<Fs64GameSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null);

  useEffect(() => {
    function syncTheme(event?: Event) {
      const nextTheme =
        event && 'detail' in event ? resolveFs64ThemeName((event as CustomEvent).detail) : readStoredFs64Theme();
      setThemeName(nextTheme);
    }

    window.addEventListener('fs64-theme-change', syncTheme as EventListener);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('fs64-theme-change', syncTheme as EventListener);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  useEffect(() => {
    const nextQuery = searchParams.get('q') || '';
    if (nextQuery !== query) setQuery(nextQuery);
  }, [searchParams, query]);

  useEffect(() => {
    const next = query.trim();
    if (next) {
      setSearchParams({ q: next }, { replace: true });
    } else if (searchParams.get('q')) {
      setSearchParams({}, { replace: true });
    }
  }, [query, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await searchGames({ q: query.trim(), limit: 250 });
        if (!cancelled) setResults(response.results || []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load games');
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  function jumpToDisk(diskId: string) {
    navigate(`/disks?diskId=${encodeURIComponent(diskId)}`);
  }

  function openMetadata(entry: Fs64GameSearchResult) {
    const firstLocation = entry.locations[0];
    if (!firstLocation) return;

    setSelectedGame({
      selectionKey: `${entry.key}|${firstLocation.diskId}|${firstLocation.side}|${Date.now()}`,
      gameName: entry.gameName,
      canonicalTitle: entry.metadata?.canonicalTitle || null,
      diskId: String(firstLocation.diskId),
      sideLabel: firstLocation.sideLabel,
    });
  }

  const cssVars = useMemo(
    () =>
      ({
        ['--fs64-background' as string]: theme.background,
        ['--fs64-panel' as string]: theme.panel,
        ['--fs64-panel-alt' as string]: theme.panelAlt,
        ['--fs64-border' as string]: theme.border,
        ['--fs64-border-soft' as string]: `${theme.border}66`,
        ['--fs64-panel-soft' as string]: theme.panel,
        ['--fs64-text' as string]: theme.text,
        ['--fs64-muted' as string]: theme.muted,
        ['--fs64-accent' as string]: theme.accent,
      }) as React.CSSProperties,
    [theme]
  );

  return (
    <section className="fs64-games-root" style={cssVars}>
      <div className="fs64-games-toolbar">
        <input
          className="fs64-games-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search games..."
          aria-label="Search games"
        />
        <div className="fs64-games-count">{loading ? 'Loading...' : `${results.length} Games`}</div>
      </div>

      {error ? <div className="fs64-games-message is-error">{error}</div> : null}
      {!loading && !error && !results.length ? <div className="fs64-games-message">No games match that search.</div> : null}

      <div className="fs64-games-grid">
        {results.map((entry) => {
          const imageUrl = entry.metadata?.images?.boxFront || entry.metadata?.images?.screenshot || entry.metadata?.images?.logo;
          const canonicalTitle = entry.metadata?.canonicalTitle || entry.gameName;
          const description = entry.metadata?.description || 'No description available.';
          return (
            <article key={entry.key} className="fs64-game-card">
              <button type="button" className="fs64-game-card-media fs64-game-card-media-btn" onClick={() => openMetadata(entry)}>
                {imageUrl ? <img src={imageUrl} alt={canonicalTitle} className="fs64-game-card-image" /> : <div className="fs64-game-card-placeholder">No Art</div>}
              </button>
              <div className="fs64-game-card-body">
                <div className="fs64-game-card-kicker">Game on Disk</div>
                <button type="button" className="fs64-game-card-title-btn" onClick={() => openMetadata(entry)}>
                  <h3 className="fs64-game-card-title">{canonicalTitle}</h3>
                </button>
                {canonicalTitle !== entry.gameName ? <div className="fs64-game-card-subtitle">{entry.gameName}</div> : null}
                <div className="fs64-game-card-meta">
                  <span>{entry.metadata?.year || 'Year ?'}</span>
                  <span>{entry.metadata?.genre || 'Genre ?'}</span>
                  <span>{entry.locations.length} locations</span>
                </div>
                <p className="fs64-game-card-description">{description}</p>
                <div className="fs64-game-card-locations">
                  {entry.locations.slice(0, 6).map((location) => (
                    <button
                      key={`${entry.key}-${location.diskId}-${location.side}-${location.slot}`}
                      type="button"
                      className="fs64-location-pill"
                      onClick={() => jumpToDisk(String(location.diskId))}
                    >
                      Disk {location.diskId} {location.sideLabel}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedGame ? <MetadataPanel selectedGame={selectedGame} onClose={() => setSelectedGame(null)} /> : null}
    </section>
  );
}

export default App;
