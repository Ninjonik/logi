"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import {
  type StratmapElement,
  type StratmapIconElement,
  type StratmapOverlaySettings,
  type StratmapSlide,
  type StratmapState,
  getHllStratmapMapById,
} from "@/lib/stratmaps";
import type { StratmapRecord } from "@/types/domain";

import { MAP_SIZE, MAX_VIEWPORT_SIZE, MIN_VIEWPORT_SIZE, type OverlayTeam, type Point, type Viewport } from "./types";

export function getActiveSlide(state: StratmapState, selectedSlideId: string) {
  return state.slides.find((slide) => slide.id === selectedSlideId) ?? state.slides[0];
}

export function clampViewport(viewport: Viewport): Viewport {
  const size = Math.max(MIN_VIEWPORT_SIZE, Math.min(MAX_VIEWPORT_SIZE, viewport.size));
  return {
    size,
    x: Math.max(0, Math.min(MAP_SIZE - size, viewport.x)),
    y: Math.max(0, Math.min(MAP_SIZE - size, viewport.y)),
  };
}

export function getPointerPoint(event: ReactPointerEvent<SVGSVGElement>, svgElement: SVGSVGElement, viewport: Viewport): Point {
  const bounds = svgElement.getBoundingClientRect();
  const relativeX = (event.clientX - bounds.left) / bounds.width;
  const relativeY = (event.clientY - bounds.top) / bounds.height;
  return {
    x: viewport.x + relativeX * viewport.size,
    y: viewport.y + relativeY * viewport.size,
  };
}

export function clampPoint(point: Point): Point {
  return {
    x: Math.max(0, Math.min(MAP_SIZE, point.x)),
    y: Math.max(0, Math.min(MAP_SIZE, point.y)),
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

export function isAreaDrag(active: { start: Point; current: Point }, threshold = 10) {
  return Math.abs(active.current.x - active.start.x) > threshold || Math.abs(active.current.y - active.start.y) > threshold;
}

export function getElementBounds(element: StratmapElement) {
  if (element.kind === "icon") {
    return { x: element.x - element.size / 2, y: element.y - element.size / 2, width: element.size, height: element.size };
  }
  if (element.kind === "text") {
    return { x: element.x, y: element.y - element.fontSize, width: element.width, height: element.fontSize * 1.3 };
  }
  if (element.kind === "line" || element.kind === "freehand" || element.kind === "polygon") {
    const xs = element.points.map((point) => point.x);
    const ys = element.points.map((point) => point.y);
    const padding = Math.max(12, (element.strokeWidth ?? 6) * 1.5);
    return { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding, width: Math.max(...xs) - Math.min(...xs) + padding * 2, height: Math.max(...ys) - Math.min(...ys) + padding * 2 };
  }
  return { x: element.x, y: element.y, width: element.width, height: element.height };
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
