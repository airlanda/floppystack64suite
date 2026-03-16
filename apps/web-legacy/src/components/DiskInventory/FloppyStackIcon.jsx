import React from "react";
import { FloppyGlyph } from "../Floppy";

export default function FloppyStackIcon({
  width = 80,
  height = 80,
  className = "",
  count = 4
}) {

  const layers = Array.from({ length: count }, (_, i) => i);
  const yOffset = -20;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 62"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        ["--floppy-case-fill"]: "var(--floppy-case)",
        ["--floppy-case-stroke"]: "var(--floppy-stroke)",
        ["--floppy-disk-fill"]: "var(--floppy-disk)",
        ["--floppy-detail-fill"]: "var(--floppy-detail)",
        ["--floppy-slot-fill"]: "var(--floppy-slot)",
      }}
    >
      
      {layers.map((i) => {

        // bottom floppy = i 0
        // top floppy = last index
        const dy = i * 1.5;   // tighter
        const dx = (count - i) * 0.5;   // tiny sideways offset
        const s  = 0.15;

        // darker overall
        const baseDark = 1;              // master darkness
        const brightness = baseDark + i * 0.08;  // top slightly brighter
        const opacity = 1

        return (
          <g
            key={i}
           transform={`translate(${dx} ${dy + yOffset}) scale(${s})`}
            opacity={opacity}
            style={{
              filter: `brightness(${brightness})`
            }}
          >
            <FloppyGlyph />
          </g>
        );
      })}
    </svg>
  );
}
