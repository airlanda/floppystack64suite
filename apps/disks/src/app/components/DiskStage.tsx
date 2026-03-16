import { useMemo } from 'react';
import { Fs64Disk } from '@fs64/domain';
import { Floppy } from './Floppy';
import { GameListColumn } from './GameListColumn';

type RateGamePayload = {
  dataset: string;
  diskId: string;
  side: 'sideA' | 'sideB';
  gameIndex: number;
  gameName: string;
  rating: number;
  previousRating: number | null;
};

type DiskStageProps = {
  currentDisk: Fs64Disk;
  totalDisks: number;
  savingRatings: Record<string, boolean>;
  mobileRatingMode?: boolean;
  activeMobileEditorKey?: string | null;
  onSetActiveMobileEditorKey?: (key: string | null) => void;
  deletingDisk: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDeleteDisk: () => void;
  onSelectGame: (payload: {
    diskId: string;
    side: 'sideA' | 'sideB';
    gameIndex: number;
    gameName: string;
  }) => void;
  onSaveGameTitles: (payload: {
    dataset: string;
    diskId: string;
    side: 'sideA' | 'sideB';
    titles: string[];
  }) => Promise<void>;
  onRateGame: (payload: RateGamePayload) => void;
};

export function DiskStage({
  currentDisk,
  totalDisks,
  savingRatings,
  mobileRatingMode = false,
  activeMobileEditorKey = null,
  onSetActiveMobileEditorKey,
  deletingDisk,
  onPrev,
  onNext,
  onDeleteDisk,
  onSelectGame,
  onSaveGameTitles,
  onRateGame,
}: DiskStageProps) {
  const diskLabelText = String(currentDisk?._id ?? '');

  const caseColor = useMemo(() => {
    const palette = ['#6b6b6b', '#c0392b', '#1e8449', '#d4ac0d', '#3a2ee3'];
    const idStr = String(currentDisk?._id ?? '0');
    let hash = 0;
    for (let index = 0; index < idStr.length; index += 1) {
      hash = (hash * 31 + idStr.charCodeAt(index)) >>> 0;
    }
    return palette[hash % palette.length];
  }, [currentDisk?._id]);

  return (
    <div className="floppy-stage">
      <Floppy
        className="floppy-svg"
        style={{
          ['--floppy-case-fill' as string]: caseColor,
          ['--floppy-case-stroke' as string]: 'var(--floppy-stroke)',
          ['--floppy-disk-fill' as string]: 'var(--floppy-disk)',
          ['--floppy-detail-fill' as string]: 'var(--floppy-detail)',
          ['--floppy-slot-fill' as string]: 'var(--floppy-slot)',
        }}
      />

      <div className="floppy-overlay">
        <div className="c64-mobile-disk-total" title={`${totalDisks} disks`} aria-label={`${totalDisks} disks`}>
          {totalDisks}
        </div>
        <button type="button" className="c64-scratch-btn" onClick={onDeleteDisk} disabled={deletingDisk} title="Scratch this disk" aria-label="Scratch this disk">
          <span>{deletingDisk ? 'Deleting...' : 'Scratch'}</span>
          <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
            <rect x="6" y="3.2" width="8" height="1.8" fill="currentColor" />
            <rect x="5" y="6" width="10" height="10.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <rect x="8" y="1.6" width="4" height="1.6" fill="currentColor" />
            <rect x="7.2" y="8.2" width="1.5" height="6.2" fill="currentColor" />
            <rect x="11.3" y="8.2" width="1.5" height="6.2" fill="currentColor" />
          </svg>
        </button>
        <div className="content-frame">
          <div className="c64-grid">
            <button type="button" className="nav-arrow nav-left" onClick={onPrev} aria-label="previous disk">
              <span>{'◀'}</span>
            </button>
            <button type="button" className="nav-arrow nav-right" onClick={onNext} aria-label="next disk">
              <span>{'▶'}</span>
            </button>

            <GameListColumn
              title="Side A"
              games={currentDisk.sideA}
              sideKey="sideA"
              diskId={String(currentDisk._id)}
              datasetKey={currentDisk.datasetKey}
              savingRatings={savingRatings}
              mobileRatingMode={mobileRatingMode}
              activeMobileEditorKey={activeMobileEditorKey}
              onSetActiveMobileEditorKey={onSetActiveMobileEditorKey}
              onRateGame={onRateGame}
              onSelectGame={onSelectGame}
              onSaveGameTitles={onSaveGameTitles}
            />

            <div className="c64-mid">
              <div className="c64-label">
                <span className="c64-label-number" aria-label={`Disk ${diskLabelText}`}>
                  {diskLabelText.split('').map((char, idx) => (
                    <span key={`${char}-${idx}`} className="c64-label-digit">
                      {char}
                    </span>
                  ))}
                </span>
              </div>
            </div>

            <GameListColumn
              title="Side B"
              games={currentDisk.sideB}
              sideKey="sideB"
              diskId={String(currentDisk._id)}
              datasetKey={currentDisk.datasetKey}
              savingRatings={savingRatings}
              mobileRatingMode={mobileRatingMode}
              activeMobileEditorKey={activeMobileEditorKey}
              onSetActiveMobileEditorKey={onSetActiveMobileEditorKey}
              onRateGame={onRateGame}
              onSelectGame={onSelectGame}
              onSaveGameTitles={onSaveGameTitles}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
