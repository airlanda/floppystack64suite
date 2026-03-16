import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Button } from "reactstrap";

import Floppy from "../Floppy.jsx";
import GameListColumn from "./GameListColumn.jsx";

/**
 * DiskStage
 * - Renders floppy SVG background + overlay content
 * - Desktop: shows left/right arrows
 * - Mobile: arrows hidden via CSS; swipe handled in DiskInventory
 * - Randomizes CASE color from a fixed palette based on disk id
 *   (stable per disk; doesn't change every render)
 */
export default function DiskStage({
  currentDisk,
  totalDisks,
  onPrev,
  onNext,
  onRateGame,
  onSelectGame,
  ratingSaveMap,
  mobileRatingMode,
  activeMobileEditorKey,
  onSetActiveMobileEditorKey,
  onSaveGameTitles,
  onDeleteDisk,
  deletingDisk,
  randomChallengeTarget,
}) {
  const diskLabelText = String(currentDisk?._id ?? "");

  // Stable “random” per disk so it doesn't flicker/re-roll on re-render
  const caseColor = useMemo(() => {
    const palette = [
      "#6b6b6b", // gray
      "#c0392b", // red
      "#1e8449", // green
      "#d4ac0d", // yellow,
      "#3a2ee3", 

    ];

    const idStr = String(currentDisk?._id ?? "0");

    // simple deterministic hash
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      hash = (hash * 31 + idStr.charCodeAt(i)) >>> 0;
    }
    return palette[hash % palette.length];
  }, [currentDisk?._id]);

  return (
    <div className="floppy-stage">
      <Floppy
        className="floppy-svg"
        caseColor={caseColor}
        caseStroke="rgba(0,0,0,0.35)"
        diskColor="rgba(16,18,22,0.90)"  // nice realistic “oxide” look
        detailColor="rgba(0,0,0,0.85)"
        slotColor="rgba(0,0,0,0.85)"
      />

      <div className="floppy-overlay">
        <div
          className="c64-mobile-disk-total"
          title={`${totalDisks} disks`}
          aria-label={`${totalDisks} disks`}
        >
          {totalDisks}
        </div>

        <button
          type="button"
          className="c64-scratch-btn"
          onClick={onDeleteDisk}
          disabled={deletingDisk}
          title="Scratch this disk"
          aria-label="Scratch this disk"
        >
          <span>{deletingDisk ? "Scratching..." : "Scratch"}</span>
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
            {/* Desktop arrows (CSS hides on mobile) */}
            <Button
              color="dark"
              className="nav-arrow nav-left"
              onClick={onPrev}
              aria-label="previous disk"
            >
              <span>◀</span>
            </Button>

            <Button
              color="dark"
              className="nav-arrow nav-right"
              onClick={onNext}
              aria-label="next disk"
            >
              <span>▶</span>
            </Button>

            {/* LEFT COLUMN: SIDE A */}
            <GameListColumn
              title="Side A"
              games={currentDisk.sideA}
              sideKey="sideA"
              diskId={currentDisk._id}
              datasetKey={currentDisk.datasetKey}
              onRateGame={onRateGame}
              onSelectGame={onSelectGame}
              ratingSaveMap={ratingSaveMap}
              mobileRatingMode={mobileRatingMode}
              activeMobileEditorKey={activeMobileEditorKey}
              onSetActiveMobileEditorKey={onSetActiveMobileEditorKey}
              onSaveGameTitles={onSaveGameTitles}
              randomChallengeTarget={randomChallengeTarget}
            />

            {/* MIDDLE COLUMN: DISK NUMBER */}
            <div className="c64-mid">
              <div
                className={`c64-label${
                  randomChallengeTarget && String(randomChallengeTarget.diskId) === String(currentDisk?._id)
                    ? " c64-label-challenge"
                    : ""
                }`}
              >
                <span className="c64-label-number" aria-label={`Disk ${diskLabelText}`}>
                  {diskLabelText.split("").map((char, idx) => (
                    <span key={`${char}-${idx}`} className="c64-label-digit">
                      {char}
                    </span>
                  ))}
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: SIDE B */}
            <GameListColumn
              title="Side B"
              games={currentDisk.sideB}
              sideKey="sideB"
              diskId={currentDisk._id}
              datasetKey={currentDisk.datasetKey}
              onRateGame={onRateGame}
              onSelectGame={onSelectGame}
              ratingSaveMap={ratingSaveMap}
              mobileRatingMode={mobileRatingMode}
              activeMobileEditorKey={activeMobileEditorKey}
              onSetActiveMobileEditorKey={onSetActiveMobileEditorKey}
              onSaveGameTitles={onSaveGameTitles}
              randomChallengeTarget={randomChallengeTarget}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

DiskStage.propTypes = {
  currentDisk: PropTypes.object.isRequired,
  totalDisks: PropTypes.number,
  onPrev: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onRateGame: PropTypes.func,
  onSelectGame: PropTypes.func,
  ratingSaveMap: PropTypes.object,
  mobileRatingMode: PropTypes.bool,
  activeMobileEditorKey: PropTypes.string,
  onSetActiveMobileEditorKey: PropTypes.func,
  onSaveGameTitles: PropTypes.func,
  onDeleteDisk: PropTypes.func,
  deletingDisk: PropTypes.bool,
  randomChallengeTarget: PropTypes.shape({
    diskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    side: PropTypes.string,
    gameIndex: PropTypes.number,
    gameName: PropTypes.string,
  }),
};
