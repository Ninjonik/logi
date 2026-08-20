"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { type StratmapElement, type StratmapShapeElement, getHllStratmapCatalog } from "@/lib/stratmaps";

import { buildArrowDecoration, buildLinePath, formatDistanceLabel, getElementDragScale, getPathLabelAngle, getPathLabelPoint, getSpawnRangeRadius } from "./utils";

export function RenderedElement({
  element,
  mode,
  selected,
  hovered,
  dragging,
  showSpawnRanges,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  element: StratmapElement;
  mode: "view" | "edit";
  selected: boolean;
  hovered: boolean;
  dragging: boolean;
  showSpawnRanges: boolean;
  onPointerDown: (elementId: string, event: ReactPointerEvent<SVGGElement>) => void;
  onPointerEnter: (elementId: string) => void;
  onPointerLeave: () => void;
}) {
  const dashArray = element.strokeStyle === "dashed" ? "24 16" : element.strokeStyle === "dotted" ? "6 12" : undefined;
  const icon = element.kind === "icon" ? getHllStratmapCatalog().find((item) => item.id === element.iconId) : null;
  const scale = element.kind === "icon" ? getElementDragScale(selected, hovered, dragging) : 1;
  const transform = getElementTransform(element, scale);

  return (
    <g
      onPointerDown={(event) => onPointerDown(element.id, event)}
      onPointerEnter={() => onPointerEnter(element.id)}
      onPointerLeave={onPointerLeave}
      style={{ cursor: mode === "view" ? "pointer" : "move", userSelect: "none", WebkitUserSelect: "none" }}
      transform={transform}
    >
      {element.kind === "icon" && icon ? <IconElement element={element} iconPath={icon.iconPath} selected={selected} hovered={hovered} /> : null}
      {element.kind === "text" ? <TextElement element={element} /> : null}
      {element.kind === "line" ? <LineElement element={element} dashArray={dashArray} /> : null}
      {element.kind === "rectangle" ? <RectangleElement element={element} dashArray={dashArray} /> : null}
      {element.kind === "ellipse" ? <EllipseElement element={element} dashArray={dashArray} /> : null}
      {element.kind === "polygon" ? <polygon points={element.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={element.fillColor ?? "rgba(57,255,20,0.2)"} stroke={element.strokeColor ?? "#39ff14"} strokeWidth={element.strokeWidth ?? 6} strokeDasharray={dashArray} /> : null}
      {element.kind === "freehand" ? <PathElement d={buildLinePath(element.points)} stroke={element.strokeColor ?? "#39ff14"} strokeWidth={element.strokeWidth ?? 6} dashArray={dashArray} /> : null}
      {element.kind === "icon" && showSpawnRanges ? <IconRangeElement element={element} /> : null}
    </g>
  );
}

function getElementTransform(element: StratmapElement, scale: number) {
  const rotation = element.rotation ?? 0;

  if (element.kind === "icon") {
    return `translate(${element.x} ${element.y}) rotate(${rotation}) scale(${scale}) translate(${-element.x} ${-element.y})`;
  }

  if (element.kind === "text") {
    return rotation ? `rotate(${rotation} ${element.x} ${element.y})` : undefined;
  }

  if (element.kind === "rectangle" || element.kind === "ellipse") {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    return rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined;
  }

  return undefined;
}

function IconElement({ element, iconPath, selected, hovered }: { element: Extract<StratmapElement, { kind: "icon" }>; iconPath: string; selected: boolean; hovered: boolean }) {
  const iconX = element.x - element.size / 2;
  const iconY = element.y - element.size / 2;

  return (
    <>
      <defs>
        <mask
          id={`stratmap-icon-mask-${element.id}`}
          maskUnits="userSpaceOnUse"
          x={iconX}
          y={iconY}
          width={element.size}
          height={element.size}
          style={{ maskType: "alpha" }}
        >
          <image
            href={iconPath}
            x={iconX}
            y={iconY}
            width={element.size}
            height={element.size}
            preserveAspectRatio="xMidYMid meet"
          />
        </mask>
      </defs>
      <rect
        x={iconX}
        y={iconY}
        width={element.size}
        height={element.size}
        fill={element.color ?? "#dc2626"}
        mask={`url(#stratmap-icon-mask-${element.id})`}
        opacity={1}
      />
    </>
  );
}

function TextElement({ element }: { element: Extract<StratmapElement, { kind: "text" }> }) {
  const lines = element.text.split(/\r?\n/);
  const lineHeight = Math.round(element.fontSize * 1.25);
  const paddingX = 10;
  const paddingY = 8;
  const boxHeight = Math.max(element.fontSize * 1.3, lines.length * lineHeight + paddingY * 2 - (lineHeight - element.fontSize));
  const boxWidth = element.width + paddingX * 2;
  const textAnchor = element.align === "center" ? "middle" : element.align === "right" ? "end" : "start";
  const textX = element.align === "center" ? element.x + element.width / 2 : element.align === "right" ? element.x + element.width : element.x;
  const boxX = element.x - paddingX;
  const boxY = element.y - element.fontSize - paddingY;
  return (
    <>
      <rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} rx={8} fill={element.backgroundColor ?? "transparent"} pointerEvents="none" />
      <text x={textX} y={element.y} textAnchor={textAnchor} fill={element.color ?? "#ffffff"} fontSize={element.fontSize} fontWeight={700} xmlSpace="preserve">
        {lines.map((line, index) => (
          <tspan key={`${index}-${line}`} x={textX} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </>
  );
}

function PathElement({ d, stroke, strokeWidth, dashArray }: { d: string; stroke: string; strokeWidth: number; dashArray?: string }) {
  return (
    <>
      <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(20, strokeWidth + 16)} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashArray} />
    </>
  );
}

function LineElement({ element, dashArray }: { element: Extract<StratmapElement, { kind: "line" }>; dashArray?: string }) {
  const stroke = element.strokeColor ?? "#39ff14";
  const strokeWidth = element.strokeWidth ?? 6;
  const labelPoint = getPathLabelPoint(element.points);
  const labelAngle = getPathLabelAngle(element.points);
  const startArrow = buildArrowDecoration(element.startStyle, element.points, "start", strokeWidth);
  const endArrow = buildArrowDecoration(element.endStyle, element.points, "end", strokeWidth);
  const startMarker = startArrow && typeof startArrow === "object" ? startArrow : null;
  const endMarker = endArrow && typeof endArrow === "object" ? endArrow : null;

  return (
    <>
      <PathElement d={buildLinePath(element.points)} stroke={stroke} strokeWidth={strokeWidth} dashArray={dashArray} />
      {typeof startArrow === "string" ? <polygon points={startArrow} fill={stroke} /> : null}
      {typeof endArrow === "string" ? <polygon points={endArrow} fill={stroke} /> : null}
      {startMarker && element.startStyle === "circle" ? <circle cx={startMarker.anchor.x} cy={startMarker.anchor.y} r={startMarker.size * 0.34} fill={stroke} /> : null}
      {endMarker && element.endStyle === "circle" ? <circle cx={endMarker.anchor.x} cy={endMarker.anchor.y} r={endMarker.size * 0.34} fill={stroke} /> : null}
      {startMarker && element.startStyle === "square" ? <rect x={startMarker.anchor.x - startMarker.size * 0.3} y={startMarker.anchor.y - startMarker.size * 0.3} width={startMarker.size * 0.6} height={startMarker.size * 0.6} fill={stroke} /> : null}
      {endMarker && element.endStyle === "square" ? <rect x={endMarker.anchor.x - endMarker.size * 0.3} y={endMarker.anchor.y - endMarker.size * 0.3} width={endMarker.size * 0.6} height={endMarker.size * 0.6} fill={stroke} /> : null}
      {element.showDistance ? (
        <g transform={`translate(${labelPoint.x} ${labelPoint.y - 18}) rotate(${labelAngle})`}>
          <rect x={-34} y={-14} width={68} height={22} rx={7} fill="rgba(10,10,10,0.72)" />
          <text x={0} y={2} textAnchor="middle" fill={stroke} fontSize={18} fontWeight={700} paintOrder="stroke" stroke="rgba(0,0,0,0.85)" strokeWidth={2}>
            {formatDistanceLabel(element.points)}
          </text>
        </g>
      ) : null}
    </>
  );
}

function IconRangeElement({ element }: { element: Extract<StratmapElement, { kind: "icon" }> }) {
  const radius = getSpawnRangeRadius(element.iconId);
  if (!radius) {
    return null;
  }

  const stroke = radius > 100 ? "#2563eb" : "#f97316";
  return <circle cx={element.x} cy={element.y} r={radius} fill="none" stroke={stroke} strokeWidth={4} strokeDasharray="16 10" opacity={0.92} pointerEvents="none" />;
}

function RectangleElement({ element, dashArray }: { element: StratmapShapeElement; dashArray?: string }) {
  return (
    <>
      <rect x={element.x} y={element.y} width={element.width} height={element.height} fill="transparent" />
      <rect x={element.x} y={element.y} width={element.width} height={element.height} fill={element.fillColor ?? "rgba(57,255,20,0.2)"} stroke={element.strokeColor ?? "#39ff14"} strokeWidth={element.strokeWidth ?? 6} strokeDasharray={dashArray} />
    </>
  );
}

function EllipseElement({ element, dashArray }: { element: StratmapShapeElement; dashArray?: string }) {
  return (
    <>
      <ellipse cx={element.x + element.width / 2} cy={element.y + element.height / 2} rx={element.width / 2} ry={element.height / 2} fill="transparent" />
      <ellipse cx={element.x + element.width / 2} cy={element.y + element.height / 2} rx={element.width / 2} ry={element.height / 2} fill={element.fillColor ?? "rgba(57,255,20,0.2)"} stroke={element.strokeColor ?? "#39ff14"} strokeWidth={element.strokeWidth ?? 6} strokeDasharray={dashArray} />
    </>
  );
}
