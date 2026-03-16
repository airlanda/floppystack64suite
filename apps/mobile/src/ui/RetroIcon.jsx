import React from "react";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

function OutlineRect({ x, y, width, height, color, strokeWidth = 1.4, rx = 0, ry = 0 }) {
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={rx}
      ry={ry}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  );
}

export default function RetroIcon({ name = "edit", size = 16, color = "#d8f2ff", accent = "#7ea5be" }) {
  const iconKey = name === "delete" ? "deleteIcon" : name;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
    >
      {iconKey === "disk" ? (
        <>
          <OutlineRect x={2.5} y={1.5} width={11} height={13} color={color} strokeWidth={1.2} />
          <OutlineRect x={4} y={3.5} width={8} height={2.5} color={color} strokeWidth={1.2} />
          <Line x1="4" y1="7.5" x2="12" y2="7.5" stroke={color} strokeWidth={1.2} />
          <OutlineRect x={5} y={10} width={6} height={3} color={color} strokeWidth={1.2} />
          <Rect x={7} y={11} width={2} height={2} fill={color} />
        </>
      ) : null}

      {iconKey === "games" ? (
        <>
          <OutlineRect x={1.5} y={1.5} width={13} height={13} color={color} strokeWidth={1.2} rx={1} ry={1} />
          <Circle cx={3.5} cy={3.5} r={1.5} fill={accent} />
          <Circle cx={8} cy={8.5} r={4.1} stroke={color} strokeWidth={1.2} />
          <Circle cx={8} cy={8.5} r={2.6} stroke={color} strokeWidth={1.2} />
          <Circle cx={8} cy={8.5} r={1.1} fill={color} />
        </>
      ) : null}

      {iconKey === "play" ? (
        <>
          <OutlineRect x={1.5} y={1.5} width={13} height={13} color={color} strokeWidth={1.2} />
          <Rect x={6} y={4} width={4} height={1.5} fill={color} />
          <Rect x={5} y={6.2} width={6} height={1.5} fill={color} />
          <Rect x={4} y={8.4} width={8} height={1.5} fill={color} />
        </>
      ) : null}

      {iconKey === "config" ? (
        <>
          <OutlineRect x={1.5} y={2.5} width={13} height={11} color={color} strokeWidth={1.2} />
          <OutlineRect x={3} y={4} width={10} height={2} color={color} strokeWidth={1.2} />
          <OutlineRect x={3} y={7} width={10} height={2} color={color} strokeWidth={1.2} />
          <OutlineRect x={3} y={10} width={10} height={2} color={color} strokeWidth={1.2} />
          <Rect x={4} y={4} width={3} height={2} fill={color} />
          <Rect x={9} y={7} width={3} height={2} fill={color} />
          <Rect x={6} y={10} width={3} height={2} fill={color} />
        </>
      ) : null}

      {iconKey === "profile" ? (
        <>
          <OutlineRect x={6} y={2} width={4} height={3} color={color} strokeWidth={1.2} />
          <OutlineRect x={5} y={5} width={6} height={3} color={color} strokeWidth={1.2} />
          <OutlineRect x={3.5} y={8.5} width={9} height={4} color={color} strokeWidth={1.2} />
          <Rect x={5} y={10} width={2} height={2} fill={color} />
          <Rect x={9} y={10} width={2} height={2} fill={color} />
        </>
      ) : null}

      {iconKey === "edit" ? (
        <>
          <OutlineRect x={2} y={2} width={9} height={12} color={color} strokeWidth={1.5} />
          <Rect x={4} y={5} width={5} height={1.2} fill={color} />
          <Rect x={4} y={7.5} width={4} height={1.2} fill={color} />
          <Rect x={11} y={10.2} width={2} height={2} fill={color} />
          <Rect x={12.6} y={8.6} width={2} height={2} fill={color} />
          <Rect x={14.2} y={7} width={2} height={2} fill={color} />
          <Rect x={15.8} y={5.4} width={1.6} height={1.6} fill={color} />
          <Rect x={10.4} y={11.8} width={1.4} height={1.4} fill={accent} opacity={0.45} />
        </>
      ) : null}

      {iconKey === "deleteIcon" ? (
        <>
          <Rect x={6} y={3.2} width={8} height={1.8} fill={color} />
          <Rect x={5} y={6} width={10} height={10.5} fill="none" stroke={color} strokeWidth={1.8} />
          <Rect x={8} y={1.6} width={4} height={1.6} fill={color} />
          <Rect x={7.2} y={8.2} width={1.5} height={6.2} fill={color} />
          <Rect x={11.3} y={8.2} width={1.5} height={6.2} fill={color} />
        </>
      ) : null}

      {iconKey === "fetch" ? (
        <>
          <Path d="M8 2a6 6 0 1 0 5.2 3" stroke={color} strokeWidth={1.4} />
          <Path d="M10.8 1.7H14v3.2" stroke={color} strokeWidth={1.4} />
          <Path d="M14 1.7 11.5 4.2" stroke={color} strokeWidth={1.4} />
        </>
      ) : null}

      {iconKey === "close" ? (
        <>
          <OutlineRect x={1.5} y={1.5} width={13} height={13} color={color} strokeWidth={1.4} />
          <Rect x={4} y={4} width={2} height={2} fill={color} />
          <Rect x={6} y={6} width={2} height={2} fill={color} />
          <Rect x={8} y={8} width={2} height={2} fill={color} />
          <Rect x={10} y={10} width={2} height={2} fill={color} />
          <Rect x={10} y={4} width={2} height={2} fill={color} />
          <Rect x={8} y={6} width={2} height={2} fill={color} />
          <Rect x={6} y={8} width={2} height={2} fill={color} />
          <Rect x={4} y={10} width={2} height={2} fill={color} />
        </>
      ) : null}
    </Svg>
  );
}
