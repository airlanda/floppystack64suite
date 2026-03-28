import './disks.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  countDiskGames,
  deleteDiskFromDataset,
  fetchDisks,
  Fs64Disk,
  normalizeGameTitle,
  saveDiskGameTitles,
  updateDiskGameRating,
} from '@fs64/domain';
import { Fs64ThemeName, getFs64Theme, readStoredFs64Theme, resolveFs64ThemeName } from '@fs64/theme';
import { DiskStage } from './components/DiskStage';
import { MetadataPanel } from './components/MetadataPanel';

export function App() {
  const [themeName, setThemeName] = useState<Fs64ThemeName>(() => readStoredFs64Theme());
  const theme = getFs64Theme(themeName);
  const location = useLocation();
  const [disks, setDisks] = useState<Fs64Disk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDiskIndex, setCurrentDiskIndex] = useState(0);
  const [savingRatings, setSavingRatings] = useState<Record<string, boolean>>({});
  const [searchValue, setSearchValue] = useState('');
  const [selectedGame, setSelectedGame] = useState<{
    selectionKey: string;
    diskId: string;
    side: 'sideA' | 'sideB';
    sideLabel: string;
    gameIndex: number;
    gameName: string;
  } | null>(null);
  const [deletingDisk, setDeletingDisk] = useState(false);
  const [mobileRatingMode, setMobileRatingMode] = useState(false);
  const [activeMobileEditorKey, setActiveMobileEditorKey] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLockRef = useRef(0);

  async function loadDisks() {
    setLoading(true);
    setError(null);
    try {
      const nextDisks = await fetchDisks();
      setDisks(nextDisks);
      setCurrentDiskIndex((prev) => (nextDisks.length ? Math.min(prev, nextDisks.length - 1) : 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load disks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDisks();
  }, []);

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
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const media = window.matchMedia('(max-width: 768px)');
    const apply = () => setMobileRatingMode(media.matches);
    apply();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  const filteredDisks = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return disks;

    return disks.filter((disk) => {
      const haystack = [...(disk.sideA || []), ...(disk.sideB || [])]
        .map(normalizeGameTitle)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query) || String(disk._id).toLowerCase().includes(query);
    });
  }, [disks, searchValue]);

  useEffect(() => {
    setCurrentDiskIndex(0);
    setActiveMobileEditorKey(null);
  }, [searchValue]);

  const summary = useMemo(() => {
    const totalGames = filteredDisks.reduce((sum, disk) => sum + countDiskGames(disk), 0);
    return { totalDisks: filteredDisks.length, totalGames };
  }, [filteredDisks]);

  const currentDisk = filteredDisks[currentDiskIndex] || null;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedDiskId = params.get('diskId');
    if (!requestedDiskId || !filteredDisks.length) return;

    const nextIndex = filteredDisks.findIndex((disk) => String(disk._id) === requestedDiskId);
    if (nextIndex >= 0 && nextIndex !== currentDiskIndex) {
      setCurrentDiskIndex(nextIndex);
    }
  }, [location.search, filteredDisks]);

  const cssVars = {
    ['--fs64-background' as string]: theme.background,
    ['--fs64-panel' as string]: theme.panel,
    ['--fs64-panel-alt' as string]: theme.panelAlt,
    ['--fs64-panel-soft' as string]: theme.panel,
    ['--fs64-border' as string]: theme.border,
    ['--fs64-border-soft' as string]: `${theme.border}66`,
    ['--fs64-text' as string]: theme.text,
    ['--fs64-muted' as string]: theme.muted,
    ['--fs64-accent' as string]: theme.accent,
    ['--fs64-disk-label-bg' as string]: theme.diskLabelBg,
    ['--fs64-disk-label-border' as string]: theme.diskLabelBorder,
    ['--fs64-disk-label-text' as string]: theme.diskLabelText,
    ['--floppy-case' as string]: theme.floppyCase,
    ['--floppy-stroke' as string]: theme.floppyStroke,
    ['--floppy-disk' as string]: theme.floppyDisk,
    ['--floppy-detail' as string]: theme.floppyDetail,
    ['--floppy-slot' as string]: theme.floppyDetail,
  } as React.CSSProperties;

  async function handleRateGame(payload: Parameters<typeof updateDiskGameRating>[0]) {
    const ratingKey = `${payload.diskId}|${payload.side}|${payload.gameIndex}|${payload.gameName}`;
    const previousDisks = disks;

    setSavingRatings((prev) => ({ ...prev, [ratingKey]: true }));
    setDisks((current) =>
      current.map((disk) => {
        if (String(disk._id) !== String(payload.diskId)) return disk;
        return {
          ...disk,
          [payload.side]: (disk[payload.side] || []).map((game, index) => {
            if (index !== payload.gameIndex) return game;
            if (typeof game === 'string') return { gameName: game, rating: payload.rating };
            return { ...game, rating: payload.rating };
          }),
        };
      })
    );

    try {
      await updateDiskGameRating(payload);
    } catch (mutationError) {
      setDisks(previousDisks);
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to save rating');
    } finally {
      setSavingRatings((prev) => {
        const next = { ...prev };
        delete next[ratingKey];
        return next;
      });
    }
  }

  async function handleSaveGameTitles(payload: Parameters<typeof saveDiskGameTitles>[0]) {
    await saveDiskGameTitles(payload);
    await loadDisks();
  }

  async function handleDeleteDisk() {
    if (!currentDisk || deletingDisk) return;
    setDeletingDisk(true);
    try {
      await deleteDiskFromDataset({ dataset: currentDisk.datasetKey || 'default', diskId: String(currentDisk._id) });
      await loadDisks();
      setCurrentDiskIndex(0);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete disk');
    } finally {
      setDeletingDisk(false);
    }
  }

  function movePrev() {
    setCurrentDiskIndex((prev) => (prev <= 0 ? filteredDisks.length - 1 : prev - 1));
  }

  function moveNext() {
    setCurrentDiskIndex((prev) => (prev >= filteredDisks.length - 1 ? 0 : prev + 1));
  }

  function onTouchStart(event: React.TouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = touchStartRef.current;
    if (!start || !filteredDisks.length || selectedGame) return;

    const now = Date.now();
    if (now - swipeLockRef.current < 220) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < 44) return;

    swipeLockRef.current = now;
    if (deltaX > 0) movePrev();
    else moveNext();
  }

  if (loading) {
    return <div style={cssVars}>Loading disks...</div>;
  }

  if (error && !filteredDisks.length) {
    return <div style={cssVars}>{error}</div>;
  }

  if (!currentDisk) {
    return (
      <section className="c64-disks-root" style={cssVars}>
        <div className="c64-disks-toolbar">
          <input
            className="c64-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search games..."
            aria-label="Search disks by game title"
          />
        </div>
        <div className="c64-empty-state">No disks match that search.</div>
      </section>
    );
  }

  return (
    <section className="c64-disks-root" style={cssVars} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="c64-disks-toolbar">
        <input
          className="c64-search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search games..."
          aria-label="Search disks by game title"
        />
      </div>
      <div className="c64-topbar">
        <div className="c64-count-center">
          <div className="c64-count">Showing {currentDiskIndex + 1} of {summary.totalDisks} disks</div>
        </div>
      </div>
      <DiskStage
        currentDisk={currentDisk}
        totalDisks={summary.totalDisks}
        savingRatings={savingRatings}
        deletingDisk={deletingDisk}
        onPrev={movePrev}
        onNext={moveNext}
        onDeleteDisk={handleDeleteDisk}
        onSelectGame={({ diskId, side, gameIndex, gameName }) =>
          setSelectedGame({
            selectionKey: `${diskId}|${side}|${gameIndex}|${String(gameName)}|${Date.now()}`,
            diskId,
            side,
            sideLabel: side === 'sideA' ? 'Side A' : 'Side B',
            gameIndex,
            gameName,
          })
        }
        mobileRatingMode={mobileRatingMode}
        activeMobileEditorKey={activeMobileEditorKey}
        onSetActiveMobileEditorKey={setActiveMobileEditorKey}
        onSaveGameTitles={handleSaveGameTitles}
        onRateGame={handleRateGame}
      />
      {selectedGame ? (
        <MetadataPanel selectedGame={selectedGame} onClose={() => setSelectedGame(null)} />
      ) : null}
    </section>
  );
}

export default App;

