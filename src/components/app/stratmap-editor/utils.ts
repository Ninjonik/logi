"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import {
  type StratmapArrowStyle,
  type StratmapElement,
  type StratmapIconElement,
  type StratmapOverlaySettings,
  type StratmapSlide,
  type StratmapSlideBackground,
  type StratmapState,
  getHllStratmapMapById,
} from "@/lib/stratmaps";
import type { StratmapRecord } from "@/types/domain";

import { MAP_SIZE, MIN_VIEWPORT_SIZE, PIXELS_PER_100_METERS, type OverlayTeam, type Point, type Viewport } from "./types";

export function getActiveSlide(state: StratmapState, selectedSlideId: string) {
  return state.slides.find((slide) => slide.id === selectedSlideId) ?? state.slides[0];
}

export function getCanvasSize(background?: StratmapSlideBackground) {
  if (background?.kind === "image" && background.imageWidth && background.imageHeight) {
    return { width: background.imageWidth, height: background.imageHeight };
  }

  return { width: MAP_SIZE, height: MAP_SIZE };
}

export function createViewport(background?: StratmapSlideBackground): Viewport {
  const canvas = getCanvasSize(background);
  return { x: 0, y: 0, width: canvas.width, height: canvas.height };
}

export function clampViewport(viewport: Viewport, background?: StratmapSlideBackground): Viewport {
  const canvas = getCanvasSize(background);
  const aspectRatio = canvas.width / canvas.height;
  const minWidth = Math.min(canvas.width, Math.max(MIN_VIEWPORT_SIZE * aspectRatio, MIN_VIEWPORT_SIZE));
  const width = Math.max(minWidth, Math.min(canvas.width, viewport.width));
  const height = width / aspectRatio;

  return {
    width,
    height,
    x: Math.max(0, Math.min(canvas.width - width, viewport.x)),
    y: Math.max(0, Math.min(canvas.height - height, viewport.y)),
  };
}

export function zoomViewport(viewport: Viewport, factor: number, anchor: Point, background?: StratmapSlideBackground): Viewport {
  const nextWidth = viewport.width * factor;
  return clampViewport({
    x: anchor.x - (anchor.x - viewport.x) * factor,
    y: anchor.y - (anchor.y - viewport.y) * factor,
    width: nextWidth,
    height: viewport.height * factor,
  }, background);
}

export function getSvgViewportMetrics(svgElement: SVGSVGElement, viewport: Viewport) {
  const bounds = svgElement.getBoundingClientRect();
  const viewportAspectRatio = viewport.width / viewport.height;
  const boundsAspectRatio = bounds.width / bounds.height;

  if (boundsAspectRatio > viewportAspectRatio) {
    const height = bounds.height;
    const width = height * viewportAspectRatio;
    return { bounds, width, height, offsetX: (bounds.width - width) / 2, offsetY: 0 };
  }

  const width = bounds.width;
  const height = width / viewportAspectRatio;
  return { bounds, width, height, offsetX: 0, offsetY: (bounds.height - height) / 2 };
}

export function getPointerPoint(event: ReactPointerEvent<SVGSVGElement>, svgElement: SVGSVGElement, viewport: Viewport): Point {
  const { bounds, width, height, offsetX, offsetY } = getSvgViewportMetrics(svgElement, viewport);
  const relativeX = (event.clientX - bounds.left - offsetX) / width;
  const relativeY = (event.clientY - bounds.top - offsetY) / height;
  return {
    x: viewport.x + Math.max(0, Math.min(1, relativeX)) * viewport.width,
    y: viewport.y + Math.max(0, Math.min(1, relativeY)) * viewport.height,
  };
}

export function clampPoint(point: Point, background?: StratmapSlideBackground): Point {
  const canvas = getCanvasSize(background);
  return {
    x: Math.max(0, Math.min(canvas.width, point.x)),
    y: Math.max(0, Math.min(canvas.height, point.y)),
  };
}

export function deriveStrongpointRadius(rects: Array<{ width: number; height: number }>) {
  return Math.max(...rects.map((rect) => Math.min(rect.width, rect.height) * 0.28), 24);
}

export function updateSlide(state: StratmapState, slideId: string, updater: (slide: StratmapSlide) => StratmapSlide) {
  return {
    ...state,
    slides: state.slides.map((slide) => (slide.id === slideId ? updater(slide) : slide)),
  };
}

export function createDefaultOverlays(mapId: string): StratmapOverlaySettings {
  const map = getHllStratmapMapById(mapId);
  return {
    showGrid: true,
    showAllStrongpoints: true,
    visibleStrongpointIds: map?.strongpoints.map((point) => point.id) ?? [],
    showOffensiveGarrisons: false,
    overlayTeam: "a",
    showArtillery: false,
    showRepairStations: false,
    showSpawnRanges: false,
  };
}

export function buildShapeBounds(start: Point, current: Point) {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

export function buildLinePath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function getPointDistance(start: Point, end: Point) {
  return Math.hypot(end.x - start.x, end.y - start.y) * 2;
}

export function getPathDistance(points: Point[]) {
  return points.slice(1).reduce((sum, point, index) => sum + getPointDistance(points[index]!, point), 0);
}

export function pixelsToMeters(pixels: number) {
  return Math.trunc((100 * pixels) / PIXELS_PER_100_METERS);
}

export function formatDistanceLabel(points: Point[]) {
  return `${pixelsToMeters(getPathDistance(points))}m`;
}

export function getPathLabelPoint(points: Point[]) {
  if (points.length === 1) return points[0]!;
  const totalLength = getPathDistance(points);
  if (!totalLength) return points[0]!;

  let traveled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const segmentLength = getPointDistance(start, end);
    if (traveled + segmentLength >= totalLength / 2) {
      const remaining = totalLength / 2 - traveled;
      const ratio = segmentLength ? remaining / segmentLength : 0;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    traveled += segmentLength;
  }

  return points[Math.floor(points.length / 2)]!;
}

export function getPathLabelAngle(points: Point[]) {
  if (points.length < 2) return 0;
  const totalLength = getPathDistance(points);
  if (!totalLength) return 0;

  let traveled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const segmentLength = getPointDistance(start, end);
    if (traveled + segmentLength >= totalLength / 2) {
      return Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
    }
    traveled += segmentLength;
  }

  const start = points[points.length - 2]!;
  const end = points[points.length - 1]!;
  return Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
}

export function getSpawnRangeRadius(iconId: string) {
  if (iconId === "garry" || iconId === "airhead" || iconId === "halftrack" || iconId === "forward") return PIXELS_PER_100_METERS;
  if (iconId === "outpost-normal" || iconId === "outpost-recon") return PIXELS_PER_100_METERS / 2;
  return null;
}

export function getArrowDecorationVector(points: Point[], edge: "start" | "end") {
  if (points.length < 2) return null;
  const anchor = edge === "start" ? points[0]! : points[points.length - 1]!;
  const neighbor = edge === "start" ? points[1]! : points[points.length - 2]!;
  const dx = anchor.x - neighbor.x;
  const dy = anchor.y - neighbor.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  return { anchor, dx: dx / length, dy: dy / length };
}

export function buildArrowDecoration(style: StratmapArrowStyle | undefined, points: Point[], edge: "start" | "end", strokeWidth: number) {
  if (!style || style === "none") return null;
  const vector = getArrowDecorationVector(points, edge);
  if (!vector) return null;

  const { anchor, dx, dy } = vector;
  const nx = -dy;
  const ny = dx;
  const size = Math.max(12, strokeWidth * 3.4);

  if (style === "arrow") {
    return `${anchor.x},${anchor.y} ${anchor.x - dx * size + nx * size * 0.52},${anchor.y - dy * size + ny * size * 0.52} ${anchor.x - dx * size - nx * size * 0.52},${anchor.y - dy * size - ny * size * 0.52}`;
  }

  return { anchor, size };
}

export function isAreaDrag(active: { start: Point; current: Point }, threshold = 10) {
  return Math.abs(active.current.x - active.start.x) > threshold || Math.abs(active.current.y - active.start.y) > threshold;
}

export function getElementBounds(element: StratmapElement) {
  if (element.kind === "icon") return { x: element.x - element.size / 2, y: element.y - element.size / 2, width: element.size, height: element.size };
  if (element.kind === "text") return { x: element.x, y: element.y - element.fontSize, width: element.width, height: element.fontSize * 1.3 };
  if (element.kind === "line" || element.kind === "freehand" || element.kind === "polygon") {
    const xs = element.points.map((point) => point.x);
    const ys = element.points.map((point) => point.y);
    const padding = Math.max(12, (element.strokeWidth ?? 6) * 1.5);
    return {
      x: Math.min(...xs) - padding,
      y: Math.min(...ys) - padding,
      width: Math.max(...xs) - Math.min(...xs) + padding * 2,
      height: Math.max(...ys) - Math.min(...ys) + padding * 2,
    };
  }
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

export function getBoundsCenter(bounds: { x: number; y: number; width: number; height: number }) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function rotatePoint(point: Point, center: Point, angleDeg: number): Point {
  const angleRad = (angleDeg * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export function getAngleFromPoint(point: Point, center: Point) {
  return Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI);
}

export function getElementsInBounds(elements: StratmapElement[], bounds: { x: number; y: number; width: number; height: number }) {
  return elements.filter((element) => {
    const rect = getElementBounds(element);
    return rect.x < bounds.x + bounds.width && rect.x + rect.width > bounds.x && rect.y < bounds.y + bounds.height && rect.y + rect.height > bounds.y;
  }).map((element) => element.id);
}

export function filterLivePings(slide: StratmapSlide, maxAgeMs: number) {
  const now = Date.now();
  return slide.pings.filter((ping) => now - new Date(ping.createdAt).getTime() < maxAgeMs);
}

export function getOverlayStrongpoints(state: StratmapOverlaySettings, pointIds: string[]) {
  return state.showAllStrongpoints ? new Set(pointIds) : new Set(state.visibleStrongpointIds);
}

export function getOverlayItems<T>(items: { a: T[]; b: T[] } | undefined, overlayTeam: OverlayTeam) {
  return items?.[overlayTeam] ?? [];
}

export function isIconElement(element: StratmapElement | null): element is StratmapIconElement {
  return element?.kind === "icon";
}

export function getElementDragScale(selected: boolean, hovered: boolean, dragging: boolean) {
  if (dragging) return 1.24;
  if (hovered || selected) return 1.12;
  return 1;
}

export function getStratmapMetaSignature(stratmap: Pick<StratmapRecord, "title" | "description" | "baseMapId" | "side" | "strongpointId">) {
  return JSON.stringify({
    title: stratmap.title,
    description: stratmap.description ?? "",
    baseMapId: stratmap.baseMapId,
    side: stratmap.side ?? "",
    strongpointId: stratmap.strongpointId ?? "",
  });
}
