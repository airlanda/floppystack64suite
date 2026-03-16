import { CSSProperties } from 'react';
import { Fs64Theme } from '@fs64/theme';

type Drive1541IconProps = {
  theme: Fs64Theme;
  width?: number;
  height?: number;
  title?: string;
  style?: CSSProperties;
  className?: string;
};

export function Drive1541Icon({
  theme,
  width = 80,
  height = 64,
  title = '1541 Drive',
  style,
  className,
}: Drive1541IconProps) {
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
      style={style}
    >
      <title>{title}</title>
      <rect x="6" y="10" width="116" height="76" rx="10" fill="transparent" stroke={theme.accent} strokeWidth="2" opacity="0.35" vectorEffect="non-scaling-stroke" />
      <rect x="6" y="10" width="116" height="76" rx="10" fill={theme.floppyCase} stroke={theme.floppyStroke} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <rect x="10" y="14" width="108" height="10" rx="6" fill="#ffffff" opacity="0.18" />
      <rect x="16" y="26" width="96" height="18" rx="5" fill={theme.panelAlt} stroke={theme.floppyStroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <rect x="74" y="30" width="28" height="3" rx="1.5" fill={theme.brandLine1} />
      <rect x="74" y="34.5" width="28" height="3" rx="1.5" fill={theme.brandLine2} />
      <rect x="74" y="39" width="28" height="3" rx="1.5" fill={theme.brandLine3} />
      <rect x="16" y="48" width="96" height="30" rx="6" fill={theme.floppyDisk} stroke={theme.floppyStroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <rect x="24" y="58" width="80" height="8" rx="4" fill="#0a0a0a" />
      <rect x="26" y="60" width="76" height="4" rx="2" fill="#000000" opacity="0.58" />
      <rect x="56" y="68" width="16" height="8" rx="2.5" fill={theme.floppyDetail} stroke={theme.floppyStroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <rect x="59" y="70" width="10" height="3" rx="1" fill="#111111" />
      <circle cx="28" cy="74" r="3.6" fill={theme.accent} stroke="#ffffff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx="40" cy="74" r="3.6" fill="#ff3b3b" stroke="#ffffff" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
