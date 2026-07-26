"use client";

import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapMap, StratmapElement, StratmapSlide } from "@/lib/stratmaps";

import { LivePingLayer } from "./live-ping-layer";
import { RenderedElement } from "./rendered-element";
import { StratmapToolbar } from "./toolbar";
import type { DragState, Tool, Viewport } from "./types";
import { buildLinePath, buildShapeBounds, getOverlayItems } from "./utils";

export function StratmapBoard({
  dictionary,
  svgRef,
  viewport,
  tool,
  selectedMap,
  activeSlide,
  overlayStrongpointIds,
  selectedElementIds,
  hoveredElementId,
  dragState,
  strokeColor,
  fillColor,
  strokeWidth,
  canUndo,
  canRedo,
  selectionCount,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToolChange,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onStartMove,
  onHoverElement,
  onClearHover,
  onRemoveSelected,
}: {
  dictionary: Dictionary;
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewport: Viewport;
  tool: Tool;
  selectedMap: HllStratmapMap | undefined;
  activeSlide: StratmapSlide | undefined;
  overlayStrongpointIds: Set<string>;
  selectedElementIds: string[];
  hoveredElementId: string | null;
  dragState: DragState | null;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  selectionCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToolChange: (tool: Tool) => void;
  onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerLeave: () => void;
  onStartMove: (elementId: string, event: ReactPointerEvent<SVGGElement>) => void;
  onHoverElement: (elementId: string) => void;
  onClearHover: (elementId: string) => void;
  onRemoveSelected: () => void;
}) {
  return (
    <Card className="flex min-h-0 flex-col rounded-xl border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 py-3">
        <div><CardTitle className="text-base">{dictionary.stratmaps.board}</CardTitle><p className="text-xs text-muted-foreground">{selectedMap ? `${selectedMap.name} | ${activeSlide?.name ?? dictionary.stratmaps.slides}` : dictionary.shared.notSet}</p></div>
        <StratmapToolbar dictionary={dictionary} tool={tool} canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onResetZoom={onResetZoom} onToolChange={onToolChange} />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-2 px-3 pb-3">
        <div className="flex min-h-0 flex-1 rounded-xl border border-border/60 bg-black/95 p-2">
          <svg ref={svgRef} viewBox={`${viewport.x} ${viewport.y} ${viewport.size} ${viewport.size}`} className={`size-full select-none rounded-lg bg-black ${tool === "select" ? "cursor-default" : "cursor-crosshair"}`} style={{ userSelect: "none", WebkitUserSelect: "none", touchAction: "none" }} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}>
            <BoardLayers selectedMap={selectedMap} activeSlide={activeSlide} overlayStrongpointIds={overlayStrongpointIds} selectedElementIds={selectedElementIds} hoveredElementId={hoveredElementId} dragState={dragState} strokeColor={strokeColor} fillColor={fillColor} strokeWidth={strokeWidth} onStartMove={onStartMove} onHoverElement={onHoverElement} onClearHover={onClearHover} />
          </svg>
        </div>
        {selectionCount ? <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={onRemoveSelected}><Trash2 className="size-4" />{dictionary.stratmaps.deleteSelected}</Button><div className="flex items-center text-xs text-muted-foreground">{selectionCount === 1 ? dictionary.stratmaps.oneSelected : dictionary.stratmaps.multipleSelected.replace("{count}", String(selectionCount))}</div></div> : null}
      </CardContent>
    </Card>
  );
}

function BoardLayers(props: { selectedMap: HllStratmapMap | undefined; activeSlide: StratmapSlide | undefined; overlayStrongpointIds: Set<string>; selectedElementIds: string[]; hoveredElementId: string | null; dragState: DragState | null; strokeColor: string; fillColor: string; strokeWidth: number; onStartMove: (elementId: string, event: ReactPointerEvent<SVGGElement>) => void; onHoverElement: (elementId: string) => void; onClearHover: (elementId: string) => void; }) {
  const { selectedMap, activeSlide, overlayStrongpointIds, selectedElementIds, hoveredElementId, dragState, strokeColor, fillColor, strokeWidth, onStartMove, onHoverElement, onClearHover } = props;
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
      {activeSlide?.elements.map((element) => <RenderedElement key={element.id} element={element as StratmapElement} selected={selectedElementIds.includes(element.id)} hovered={hoveredElementId === element.id} dragging={dragState?.mode === "move" && dragState.elementIds.includes(element.id)} onPointerDown={onStartMove} onPointerEnter={onHoverElement} onPointerLeave={() => onClearHover(element.id)} />)}
      {dragState?.mode === "freehand" ? <path d={buildLinePath(dragState.points)} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {dragState?.mode === "line" ? <line x1={dragState.start.x} y1={dragState.start.y} x2={dragState.current.x} y2={dragState.current.y} stroke={strokeColor} strokeWidth={strokeWidth} /> : null}
      {dragState?.mode === "rectangle" ? <rect {...buildShapeBounds(dragState.start, dragState.current)} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} /> : null}
      {dragState?.mode === "ellipse" ? <ellipse cx={(dragState.start.x + dragState.current.x) / 2} cy={(dragState.start.y + dragState.current.y) / 2} rx={Math.abs(dragState.current.x - dragState.start.x) / 2} ry={Math.abs(dragState.current.y - dragState.start.y) / 2} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} /> : null}
      {dragState?.mode === "selectArea" || dragState?.mode === "deleteArea" ? <rect {...buildShapeBounds(dragState.start, dragState.current)} fill={dragState.mode === "deleteArea" ? "rgba(220,38,38,0.16)" : "rgba(37,99,235,0.14)"} stroke={dragState.mode === "deleteArea" ? "#dc2626" : "#2563eb"} strokeWidth={4} strokeDasharray="16 12" /> : null}
      <LivePingLayer pings={activeSlide?.pings ?? []} />
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
