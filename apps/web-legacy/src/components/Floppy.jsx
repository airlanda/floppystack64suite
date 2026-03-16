import React from "react";
import PropTypes from "prop-types";

/**
 * Floppy (5.25") - refactored from your SVG
 * - Same realistic geometry
 * - Easy styling via CSS variables + semantic ids
 *
 * Usage:
 * <Floppy className="floppy-svg" />
 *
 * Or theme it:
 * <Floppy
 *   caseColor="#f20808"
 *   caseStroke="rgba(0,0,0,0.55)"
 *   diskColor="rgba(0,0,0,0.60)"
 *   detailColor="#111"
 * />
 */
export default function Floppy({
  className,
  title = '5.25" Disk',
  style
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      style={{
        ["--floppy-case-fill"]: "var(--floppy-case)",
        ["--floppy-case-stroke"]: "var(--floppy-stroke)",
        ["--floppy-disk-fill"]: "var(--floppy-disk)",
        ["--floppy-detail-fill"]: "var(--floppy-detail)",
        ["--floppy-slot-fill"]: "var(--floppy-slot)",
        ...style,
      }}
    >

      <title>{title}</title>

      {/* NOTE:
          Your original SVG uses a translate(0 -552.36) group.
          We keep it to preserve geometry exactly.
      */}
      <g transform="translate(0 -552.36)">
        {/* ===== CASE (plastic shell) ===== */}
        <path
          id="floppy-case"
          d="m7.75 552.36c-4.2983 0-7.75 3.4391-7.75 7.7227v484.55c0 4.2836 3.4517 7.7227 7.75 7.7227h181.94c-2.4e-4 -0.021 0-0.0415 0-0.0625 0-3.37 3.105-6.1035 6.9375-6.1035s6.9375 2.7335 6.9375 6.1035c0 0.021 2.4e-4 0.0415 0 0.0625h90.062c-2.4e-4 -0.021 0-0.0415 0-0.0625 0-3.37 3.105-6.1035 6.9375-6.1035s6.9375 2.7335 6.9375 6.1035c0 0.021 2.4e-4 0.0415 0 0.0625h184.75c4.2983 0 7.75-3.4391 7.75-7.7227v-353.6h-13.375c-0.95517 0-1.75-0.76099-1.75-1.7129v-18.873c0-0.9519 0.79483-1.7129 1.75-1.7129h13.375v-108.66c0-4.2836-3.4517-7.7227-7.75-7.7227h-484.5zm242.21 199.02a53.689 53.505 0 0 1 53.689 53.504 53.689 53.505 0 0 1-53.689 53.506 53.689 53.505 0 0 1-53.689-53.506 53.689 53.505 0 0 1 53.689-53.504z"
          fill="var(--floppy-case-fill)"
          stroke="var(--floppy-case-stroke)"
          strokeWidth="1"
        />

        {/* ===== DETAILS (separated so you can recolor easily) ===== */}
        <g id="floppy-details" fill="var(--floppy-detail-fill)" stroke="var(--floppy-detail-fill)">
          {/* Bottom slot / handle */}
          <rect
            id="floppy-slot"
            x="224.44"
            y="906.75"
            width="49.877"
            height="124.26"
            ry="25.43"
            fill="var(--floppy-slot-fill)"
            stroke="var(--floppy-slot-fill)"
            strokeWidth="0.86059"
          />
          

          {/* Index hole dot */}
          <path
            id="floppy-index-hole"
            transform="matrix(.86207 0 0 .85912 -75.377 340)"
            d="m500.71 564.15c0 7.1008-5.7563 12.857-12.857 12.857-7.1008 0-12.857-5.7563-12.857-12.857 0-7.1008 5.7563-12.857 12.857-12.857 7.1008 0 12.857 5.7563 12.857 12.857z"
            fill="var(--floppy-disk-fill)"
            stroke="var(--floppy-disk-fill)"
            strokeWidth="1"
          />

          {/* Magnetic disk ring + hub (this is the part you likely want to recolor separately) */}
          <path
            id="floppy-disk"
            transform="matrix(.89421 0 0 .89115 -92.393 324.42)"
            d="m382.86 453.43a85.714 85.714 0 0 0-85.714 85.713 85.714 85.714 0 0 0 85.714 85.715 85.714 85.714 0 0 0 85.714-85.715 85.714 85.714 0 0 0-85.714-85.713zm0 25.674a60.041 60.041 0 0 1 60.041 60.039 60.041 60.041 0 0 1-60.041 60.042 60.041 60.041 0 0 1-60.041-60.042 60.041 60.041 0 0 1 60.041-60.039z"
            fill="var(--floppy-disk-fill)"
            stroke="none"
          />
        </g>
      </g>
    </svg>
  );
}

Floppy.propTypes = {
  className: PropTypes.string,
  title: PropTypes.string,

  // Theming
  caseColor: PropTypes.string,
  caseStroke: PropTypes.string,
  diskColor: PropTypes.string,
  detailColor: PropTypes.string,
  slotColor: PropTypes.string,

  style: PropTypes.object,
};


/** Reusable floppy geometry (no outer <svg>) */
export function FloppyGlyph() {
  return (
    <g transform="translate(0 -552.36)">
      {/* ===== CASE (plastic shell) ===== */}
      <path
        id="floppy-case"
        d="m7.75 552.36c-4.2983 0-7.75 3.4391-7.75 7.7227v484.55c0 4.2836 3.4517 7.7227 7.75 7.7227h181.94c-2.4e-4 -0.021 0-0.0415 0-0.0625 0-3.37 3.105-6.1035 6.9375-6.1035s6.9375 2.7335 6.9375 6.1035c0 0.021 2.4e-4 0.0415 0 0.0625h90.062c-2.4e-4 -0.021 0-0.0415 0-0.0625 0-3.37 3.105-6.1035 6.9375-6.1035s6.9375 2.7335 6.9375 6.1035c0 0.021 2.4e-4 0.0415 0 0.0625h184.75c4.2983 0 7.75-3.4391 7.75-7.7227v-353.6h-13.375c-0.95517 0-1.75-0.76099-1.75-1.7129v-18.873c0-0.9519 0.79483-1.7129 1.75-1.7129h13.375v-108.66c0-4.2836-3.4517-7.7227-7.75-7.7227h-484.5zm242.21 199.02a53.689 53.505 0 0 1 53.689 53.504 53.689 53.505 0 0 1-53.689 53.506 53.689 53.505 0 0 1-53.689-53.506 53.689 53.505 0 0 1 53.689-53.504z"
        fill="var(--floppy-case-fill)"
        stroke="var(--floppy-case-stroke)"
        strokeWidth="1"
      />

      {/* ===== DETAILS ===== */}
      <g id="floppy-details" fill="var(--floppy-detail-fill)" stroke="var(--floppy-detail-fill)">
        {/* Bottom slot / handle */}
        <rect
          id="floppy-slot"
          x="224.44"
          y="906.75"
          width="59.877"
          height="134.26"
          ry="25.43"
          fill="var(--floppy-slot-fill)"
          stroke="var(--floppy-slot-fill)"
          strokeWidth="0.86059"
        />

        {/* Index hole dot */}
        <path
          id="floppy-index-hole"
          transform="matrix(.86207 0 0 .85912 -75.377 340)"
          d="m500.71 564.15c0 7.1008-5.7563 12.857-12.857 12.857-7.1008 0-12.857-5.7563-12.857-12.857 0-7.1008 5.7563-12.857 12.857-12.857 7.1008 0 12.857 5.7563 12.857 12.857z"
          fill="var(--floppy-disk-fill)"
          stroke="var(--floppy-disk-fill)"
          strokeWidth="1"
        />

        {/* Magnetic disk ring + hub */}
        <path
          id="floppy-disk"
          transform="matrix(.89421 0 0 .89115 -92.393 324.42)"
          d="m382.86 453.43a85.714 85.714 0 0 0-85.714 85.713 85.714 85.714 0 0 0 85.714 85.715 85.714 85.714 0 0 0 85.714-85.715 85.714 85.714 0 0 0-85.714-85.713zm0 25.674a60.041 60.041 0 0 1 60.041 60.039 60.041 60.041 0 0 1-60.041 60.042 60.041 60.041 0 0 1-60.041-60.042 60.041 60.041 0 0 1 60.041-60.039z"
          fill="var(--floppy-disk-fill)"
          stroke="none"
        />
      </g>
    </g>
  );
}
