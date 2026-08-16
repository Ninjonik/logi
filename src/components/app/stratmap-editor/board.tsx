"use client";

import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, MouseEvent as ReactMouseEvent } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { HllStratmapMap, StratmapElement, StratmapSlide } from "@/lib/stratmaps";

import { LivePingLayer } from "./live-ping-layer";
import { RenderedElement } from "./rendered-element";
import type { DragState, Tool, Viewport } from "./types";
import { buildLinePath, buildShapeBounds, formatDistanceLabel, getOverlayItems, getPathLabelAngle, getPathLabelPoint } from "./utils";

export function StratmapBoard({
  svgRef,
  viewport,
  tool,
  mode,
  selectedMap,
  activeSlide,
  overlayStrongpointIds,
  selectedElementIds,
  hoveredElementId,
  dragState,
  strokeColor,
  fillColor,
  strokeWidth,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onContextMenu,
  onStartMove,
  onHoverElement,
  onClearHover,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewport: Viewport;
  tool: Tool;
  mode: "view" | "edit";
  selectedMap: HllStratmapMap | undefined;
  activeSlide: StratmapSlide | undefined;
  overlayStrongpointIds: Set<string>;
  selectedElementIds: string[];
  hoveredElementId: string | null;
  dragState: DragState | null;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerLeave: () => void;
  onContextMenu: (event: ReactMouseEvent<SVGSVGElement>) => void;
  onStartMove: (elementId: string, event: ReactPointerEvent<SVGGElement>) => void;
  onHoverElement: (elementId: string) => void;
  onClearHover: (elementId: string) => void;
}) {
  return (
    <Card className="flex min-h-0 flex-col rounded-xl border-border/60">
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-2 px-3 py-3">
        <div className="flex min-h-0 flex-1 rounded-xl border border-border/60 bg-black/95 p-2">
          <svg ref={svgRef} viewBox={`${viewport.x} ${viewport.y} ${viewport.size} ${viewport.size}`} className={`size-full select-none rounded-lg bg-black ${mode === "view" ? "cursor-default" : tool === "select" ? "cursor-default" : "cursor-crosshair"}`} style={{ userSelect: "none", WebkitUserSelect: "none", touchAction: "none" }} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave} onContextMenu={onContextMenu}>
      <BoardLayers mode={mode} selectedMap={selectedMap} activeSlide={activeSlide} overlayStrongpointIds={overlayStrongpointIds} selectedElementIds={selectedElementIds} hoveredElementId={hoveredElementId} dragState={dragState} strokeColor={strokeColor} fillColor={fillColor} strokeWidth={strokeWidth} onStartMove={onStartMove} onHoverElement={onHoverElement} onClearHover={onClearHover} />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

function BoardLayers(props: { mode: "view" | "edit"; selectedMap: HllStratmapMap | undefined; activeSlide: StratmapSlide | undefined; overlayStrongpointIds: Set<string>; selectedElementIds: string[]; hoveredElementId: string | null; dragState: DragState | null; strokeColor: string; fillColor: string; strokeWidth: number; onStartMove: (elementId: string, event: ReactPointerEvent<SVGGElement>) => void; onHoverElement: (elementId: string) => void; onClearHover: (elementId: string) => void; }) {
  const { mode, selectedMap, activeSlide, overlayStrongpointIds, selectedElementIds, hoveredElementId, dragState, strokeColor, fillColor, strokeWidth, onStartMove, onHoverElement, onClearHover } = props;
  return (
    <>
      {selectedMap ? <image href={selectedMap.imagePath} x={0} y={0} width={1920} height={1920} preserveAspectRatio="none" /> : null}
      {activeSlide?.overlays.showGrid ? <GridOverlay /> : null}
      {selectedMap?.strongpoints
        .filter((point) => overlayStrongpointIds.has(point.id))
        .map((point) => (
          <g key={point.id} style={{ userSelect: "none", WebkitUserSelect: "none" }}>
            <image
              href={point.spritePath}
              x={point.bounds.x}
              y={point.bounds.y}
              width={point.bounds.width}
              height={point.bounds.height}
              preserveAspectRatio="none"
              pointerEvents="none"
            />
          </g>
        ))}
      {activeSlide?.overlays.showOffensiveGarrisons ? getOverlayItems(selectedMap?.defaultElements.offensiveGarrisons, activeSlide.overlays.overlayTeam).map((item, index) => <image key={`og-${index}`} href="/stratmap/assets/garry-plain-invalid.png" x={item.x - 22} y={item.y - 22} width={44} height={44} />) : null}
      {activeSlide?.overlays.showArtillery ? getOverlayItems(selectedMap?.defaultElements.artillery, activeSlide.overlays.overlayTeam).map((item, index) => <image key={`arty-${index}`} href="/stratmap/assets/arty.png" x={item.x - 18} y={item.y - 18} width={36} height={36} transform={`rotate(${item.angle}, ${item.x}, ${item.y})`} />) : null}
      {activeSlide?.overlays.showRepairStations ? getOverlayItems(selectedMap?.defaultElements.repairStations, activeSlide.overlays.overlayTeam).map((item, index) => <image key={`repair-${index}`} href="/stratmap/assets/repair-station.png" x={item.x - 18} y={item.y - 18} width={36} height={36} />) : null}
      {activeSlide?.elements.map((element) => <RenderedElement key={element.id} mode={mode} element={element as StratmapElement} selected={selectedElementIds.includes(element.id)} hovered={hoveredElementId === element.id} dragging={dragState?.mode === "move" && dragState.elementIds.includes(element.id)} showSpawnRanges={activeSlide.overlays.showSpawnRanges} onPointerDown={onStartMove} onPointerEnter={onHoverElement} onPointerLeave={() => onClearHover(element.id)} />)}
      {dragState?.mode === "freehand" ? <path d={buildLinePath(dragState.points)} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {dragState?.mode === "line" ? <line x1={dragState.start.x} y1={dragState.start.y} x2={dragState.current.x} y2={dragState.current.y} stroke={strokeColor} strokeWidth={strokeWidth} /> : null}
      {dragState?.mode === "polygon" ? <PolygonPreview points={dragState.points} current={dragState.current} strokeColor={strokeColor} strokeWidth={strokeWidth} fillColor={fillColor} /> : null}
      {dragState?.mode === "measure" ? <MeasurePreview points={dragState.points} current={dragState.current} strokeColor={strokeColor} strokeWidth={strokeWidth} /> : null}
      {dragState?.mode === "rectangle" ? <rect {...buildShapeBounds(dragState.start, dragState.current)} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} /> : null}
      {dragState?.mode === "ellipse" ? <ellipse cx={(dragState.start.x + dragState.current.x) / 2} cy={(dragState.start.y + dragState.current.y) / 2} rx={Math.abs(dragState.current.x - dragState.start.x) / 2} ry={Math.abs(dragState.current.y - dragState.start.y) / 2} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} /> : null}
      {dragState?.mode === "selectArea" || dragState?.mode === "deleteArea" ? <rect {...buildShapeBounds(dragState.start, dragState.current)} fill={dragState.mode === "deleteArea" ? "rgba(220,38,38,0.16)" : "rgba(37,99,235,0.14)"} stroke={dragState.mode === "deleteArea" ? "#dc2626" : "#2563eb"} strokeWidth={4} strokeDasharray="16 12" /> : null}
      <LivePingLayer pings={activeSlide?.pings ?? []} />
    </>
  );
}

function PolygonPreview({ points, current, strokeColor, strokeWidth, fillColor }: { points: Array<{ x: number; y: number }>; current: { x: number; y: number }; strokeColor: string; strokeWidth: number; fillColor: string }) {
  const previewPoints = [...points, current];

  return (
    <>
      <polyline points={previewPoints.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="16 10" strokeLinejoin="round" strokeLinecap="round" />
      {points.length >= 2 ? <polygon points={previewPoints.map((point) => `${point.x},${point.y}`).join(" ")} fill={fillColor} opacity={0.45} /> : null}
      {points.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={8} fill={index === 0 ? "#ffffff" : strokeColor} stroke={strokeColor} strokeWidth={3} />)}
    </>
  );
}

function MeasurePreview({ points, current, strokeColor, strokeWidth }: { points: Array<{ x: number; y: number }>; current: { x: number; y: number }; strokeColor: string; strokeWidth: number }) {
  const previewPoints = [...points, current];
  const labelPoint = getPathLabelPoint(previewPoints);
  const labelAngle = getPathLabelAngle(previewPoints);

  return (
    <>
      <polyline points={previewPoints.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="12 8" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={7} fill={strokeColor} />)}
      {previewPoints.length >= 2 ? (
        <g transform={`translate(${labelPoint.x} ${labelPoint.y - 18}) rotate(${labelAngle})`}>
          <rect x={-34} y={-14} width={68} height={22} rx={7} fill="rgba(10,10,10,0.72)" />
          <text x={0} y={2} textAnchor="middle" fill={strokeColor} fontSize={18} fontWeight={700} paintOrder="stroke" stroke="rgba(0,0,0,0.85)" strokeWidth={2}>
            {formatDistanceLabel(previewPoints)}
          </text>
        </g>
      ) : null}
    </>
  );
}

function GridOverlay() {
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  return (
    <g opacity={0.45}>
      {Array.from({ length: 11 }).map((_, index) => {
        const offset = index * 192;
        return <g key={offset}><line x1={offset} y1={0} x2={offset} y2={1920} stroke="rgba(255,255,255,0.42)" strokeWidth={1.5} /><line x1={0} y1={offset} x2={1920} y2={offset} stroke="rgba(255,255,255,0.42)" strokeWidth={1.5} /></g>;
      })}
      {labels.map((label, index) => (
        <text
          key={`top-${label}`}
          x={index * 192 + 8}
          y={20}
          fill="rgba(255,255,255,0.9)"
          fontSize={18}
          fontWeight={500}
          stroke="rgba(0,0,0,0.85)"
          strokeWidth={2}
          paintOrder="stroke"
          pointerEvents="none"
        >
          {label}
        </text>
      ))}
      {Array.from({ length: 10 }).map((_, index) => (
        <text
          key={`left-${index + 1}`}
          x={8}
          y={index * 192 + 28}
          fill="rgba(255,255,255,0.9)"
          fontSize={18}
          fontWeight={500}
          stroke="rgba(0,0,0,0.85)"
          strokeWidth={2}
          paintOrder="stroke"
          pointerEvents="none"
        >
          {index + 1}
        </text>
      ))}
    </g>
  );
}
