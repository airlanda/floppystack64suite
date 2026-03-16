import React from "react";
import Svg, { Circle, Ellipse, Rect } from "react-native-svg";

export default function Drive1541Icon({
  width = 95,
  height = 55,
  title = "1541 Drive",
  caseColor = "#4f5964",
  strokeColor = "#0b0f15",
  faceColor = "#182331",
  detailColor = "#9fb5c9",
  ledColor = "#5dd7ff",
  stripe1 = "rgba(255,255,255,0.7)",
  stripe2 = "rgba(255,255,255,0.45)",
  stripe3 = "rgba(255,255,255,0.25)",
}) {
  return (
    <Svg viewBox="0 0 128 96" width={width} height={height} accessibilityLabel={title}>
      <Rect x="6" y="10" width="116" height="76" rx="10" fill="transparent" stroke={ledColor} strokeWidth="2" opacity="0.28" />
      <Rect x="6" y="10" width="116" height="76" rx="10" fill={caseColor} stroke={strokeColor} strokeWidth="3" />
      <Rect x="10" y="14" width="108" height="10" rx="6" fill="#ffffff" opacity="0.18" />
      <Rect x="16" y="26" width="96" height="18" rx="5" fill={strokeColor} stroke={strokeColor} strokeWidth="2" opacity="0.96" />
      <Rect x="74" y="30" width="28" height="3" rx="1.5" fill={stripe1} />
      <Rect x="74" y="34.5" width="28" height="3" rx="1.5" fill={stripe2} />
      <Rect x="74" y="39" width="28" height="3" rx="1.5" fill={stripe3} />
      <Rect x="16" y="48" width="96" height="30" rx="6" fill={faceColor} stroke={strokeColor} strokeWidth="2" />
      <Rect x="24" y="58" width="80" height="8" rx="4" fill="#0a0a0a" />
      <Rect x="26" y="60" width="76" height="4" rx="2" fill="#000000" opacity="0.58" />
      <Rect x="56" y="68" width="16" height="8" rx="2.5" fill={detailColor} stroke={strokeColor} strokeWidth="2" />
      <Rect x="59" y="70" width="10" height="3" rx="1" fill="#111111" />
      <Circle cx="28" cy="74" r="3.6" fill={ledColor} stroke="#ffffff" strokeWidth="1.5" />
      <Circle cx="40" cy="74" r="3.6" fill="#ff3b3b" stroke="#ffffff" strokeWidth="1.2" opacity="0.95" />
      <Ellipse cx="64" cy="90" rx="40" ry="4" fill="#000000" opacity="0.25" />
    </Svg>
  );
}
