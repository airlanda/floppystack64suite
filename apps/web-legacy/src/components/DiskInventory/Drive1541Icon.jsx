import React from "react";

export default function Drive1541Icon({
  width = 80,
  height = 64,
  className = "",
  title = "1541 Drive"
}) {
  return (
    <svg
      viewBox="0 0 128 96"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      shapeRendering="geometricPrecision"
      style={{
        ["--drive-case"]: "var(--floppy-case)",
        ["--drive-stroke"]: "var(--floppy-stroke)",
        ["--drive-face"]: "var(--floppy-disk)",
        ["--drive-detail"]: "var(--floppy-detail)",
        ["--drive-led"]: "var(--accent)",
        ["--drive-stripe-1"]: "var(--brand-line-1)",
        ["--drive-stripe-2"]: "var(--brand-line-2)",
        ["--drive-stripe-3"]: "var(--brand-line-3)"
      }}
    >
      <title>{title}</title>

      {/* Subtle outer glow to stand out on blue/dark themes */}
      <rect
        x="6"
        y="10"
        width="116"
        height="76"
        rx="10"
        fill="transparent"
        stroke="color-mix(in srgb, var(--drive-led) 35%, transparent)"
        strokeWidth="2"
        opacity="0.35"
        vectorEffect="non-scaling-stroke"
      />

      {/* OUTER CASE (brighter so it pops) */}
      <rect
        x="6"
        y="10"
        width="116"
        height="76"
        rx="10"
        fill="color-mix(in srgb, var(--drive-case) 72%, white 28%)"
        stroke="var(--drive-stroke)"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />

      TOP HIGHLIGHT
      <rect
        x="10"
        y="14"
        width="108"
        height="10"
        rx="6"
        fill="white"
        opacity="0.22"
      />

      {/* TOP LABEL PANEL */}
      <rect
        x="16"
        y="26"
        width="96"
        height="18"
        rx="5"
        fill="color-mix(in srgb, var(--drive-case) 55%, black 45%)"
        stroke="var(--drive-stroke)"
        strokeWidth="2"
        opacity="0.96"
        vectorEffect="non-scaling-stroke"
      />

      {/* 1541 STRIPES */}
      <rect x="74" y="30" width="28" height="3" rx="1.5" fill="var(--drive-stripe-1)" />
      <rect x="74" y="34.5" width="28" height="3" rx="1.5" fill="var(--drive-stripe-2)" />
      <rect x="74" y="39" width="28" height="3" rx="1.5" fill="var(--drive-stripe-3)" />

      {/* FACEPLATE (slightly brighter) */}
      <rect
        x="16"
        y="48"
        width="96"
        height="30"
        rx="6"
        fill="color-mix(in srgb, var(--drive-face) 78%, white 22%)"
        stroke="var(--drive-stroke)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />

      {/* SLOT — ALWAYS DARK */}
      <rect
        x="24"
        y="58"
        width="80"
        height="8"
        rx="4"
        fill="#0a0a0a"
      />

      {/* SLOT INNER SHADOW */}
      <rect
        x="26"
        y="60"
        width="76"
        height="4"
        rx="2"
        fill="#000"
        opacity="0.58"
      />

      {/* EJECT BUTTON (outer themed) */}
      <rect
        x="56"
        y="68"
        width="16"
        height="8"
        rx="2.5"
        fill="color-mix(in srgb, var(--drive-detail) 62%, white 38%)"
        stroke="var(--drive-stroke)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />

      {/* GRAB CENTER — ALWAYS DARK */}
      <rect
        x="59"
        y="70"
        width="10"
        height="3"
        rx="1"
        fill="#111"
      />

      {/* POWER LED */}
      <circle
        cx="28"
        cy="74"
        r="3.6"
        fill="var(--drive-led)"
        stroke="white"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* RED ACTIVITY LED */}
      <circle
        cx="40"
        cy="74"
        r="3.6"
        fill="#ff3b3b"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.95"
        vectorEffect="non-scaling-stroke"
      />

      {/* BOTTOM SHADOW */}
      <ellipse
        cx="64"
        cy="90"
        rx="40"
        ry="4"
        fill="black"
        opacity="0.25"
      />
    </svg>
  );
}
