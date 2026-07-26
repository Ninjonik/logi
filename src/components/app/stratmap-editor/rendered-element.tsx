"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import { type StratmapElement, type StratmapShapeElement, getHllStratmapCatalog } from "@/lib/stratmaps";

import { buildLinePath, getElementDragScale } from "./utils";

export function RenderedElement({
  element,
  selected,
  hovered,
  dragging,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  element: StratmapElement;
  selected: boolean;
  hovered: boolean;
  dragging: boolean;
  onPointerDown: (elementId: string, event: ReactPointerEvent<SVGGElement>) => void;
  onPointerEnter: (elementId: string) => void;
  onPointerLeave: () => void;
}) {
  const dashArray = element.strokeStyle === "dashed" ? "24 16" : element.strokeStyle === "dotted" ? "6 12" : undefined;
  const icon = element.kind === "icon" ? getHllStratmapCatalog().find((item) => item.id === element.iconId) : null;
  const scale = element.kind === "icon" ? getElementDragScale(selected, hovered, dragging) : 1;

  return (
    <g
      onPointerDown={(event) => onPointerDown(element.id, event)}
      onPointerEnter={() => onPointerEnter(element.id)}
      onPointerLeave={onPointerLeave}
      style={{ cursor: "move", userSelect: "none", WebkitUserSelect: "none" }}
      transform={element.kind === "icon" ? `translate(${element.x} ${element.y}) scale(${scale}) translate(${-element.x} ${-element.y})` : undefined}
    >
      {element.kind === "icon" && icon ? <IconElement element={element} iconPath={icon.iconPath} selected={selected} hovered={hovered} /> : null}
      {element.kind === "text" ? <TextElement element={element} /> : null}
      {element.kind === "line" ? <PathElement d={buildLinePath(element.points)} stroke={element.strokeColor ?? "#39ff14"} strokeWidth={element.strokeWidth ?? 6} dashArray={dashArray} /> : null}
      {element.kind === "rectangle" ? <RectangleElement element={element} dashArray={dashArray} /> : null}
      {element.kind === "ellipse" ? <EllipseElement element={element} dashArray={dashArray} /> : null}
      {element.kind === "polygon" ? <polygon points={element.points.map((point) => `${point.x},${point.y}`).join(" ")} fill={element.fillColor ?? "rgba(57,255,20,0.2)"} stroke={element.strokeColor ?? "#39ff14"} strokeWidth={element.strokeWidth ?? 6} strokeDasharray={dashArray} /> : null}
      {element.kind === "freehand" ? <PathElement d={buildLinePath(element.points)} stroke={element.strokeColor ?? "#39ff14"} strokeWidth={element.strokeWidth ?? 6} dashArray={dashArray} /> : null}
    </g>
  );
}

function IconElement({ element, iconPath, selected, hovered }: { element: Extract<StratmapElement, { kind: "icon" }>; iconPath: string; selected: boolean; hovered: boolean }) {
  return (
    <>
      <circle cx={element.x} cy={element.y} r={Math.max(20, element.size * 0.6)} fill="transparent" />
      {selected || hovered ? <circle cx={element.x} cy={element.y} r={element.size * 0.72} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth={2} /> : null}
      <defs>
        <mask id={`stratmap-icon-mask-${element.id}`} maskUnits="userSpaceOnUse" x={element.x - element.size / 2} y={element.y - element.size / 2} width={element.size} height={element.size}>
          <image href={iconPath} x={element.x - element.size / 2} y={element.y - element.size / 2} width={element.size} height={element.size} preserveAspectRatio="xMidYMid meet" />
        </mask>
      </defs>
      <rect
        x={element.x - element.size / 2}
        y={element.y - element.size / 2}
        width={element.size}
        height={element.size}
        fill={element.color ?? "#dc2626"}
        mask={`url(#stratmap-icon-mask-${element.id})`}
        opacity={0.96}
      />
    </>
  );
}

function TextElement({ element }: { element: Extract<StratmapElement, { kind: "text" }> }) {
  return (
    <>
      <rect x={element.x - 8} y={element.y - element.fontSize} width={element.width} height={element.fontSize * 1.3} fill="transparent" />
      <text x={element.x} y={element.y} fill={element.color ?? "#ffffff"} fontSize={element.fontSize} fontWeight={700}>{element.text}</text>
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
