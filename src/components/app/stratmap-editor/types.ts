"use client";

import type {
  StratmapElement,
  StratmapState,
} from "@/lib/stratmaps";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StratmapRecord } from "@/types/domain";

export type Tool = "select" | "freehand" | "line" | "polygon" | "measure" | "rectangle" | "ellipse" | "text" | "icon" | "delete" | "ping";
export type Point = { x: number; y: number };
export type ClientPoint = { x: number; y: number };
export type OverlayTeam = "a" | "b";
export type PingShape = { id: string; x: number; y: number; color: string; createdAt: string };
export type Viewport = { x: number; y: number; size: number };

export type DragState =
  | { mode: "move"; elementIds: string[]; origin: Point; snapshots: Array<{ id: string; element: StratmapElement }> }
  | { mode: "rotate"; elementIds: string[]; center: Point; startAngle: number; snapshots: Array<{ id: string; element: StratmapElement }> }
  | { mode: "pan"; origin: ClientPoint; viewport: Viewport }
  | { mode: "freehand"; points: Point[] }
  | { mode: "line"; start: Point; current: Point }
  | { mode: "polygon"; points: Point[]; current: Point }
  | { mode: "measure"; points: Point[]; current: Point }
  | { mode: "rectangle"; start: Point; current: Point }
  | { mode: "ellipse"; start: Point; current: Point }
  | { mode: "selectArea"; start: Point; current: Point }
  | { mode: "deleteArea"; start: Point; current: Point };

export type EditorMetaState = {
  title: string;
  description: string;
  baseMapId: string;
  side: string;
  strongpointId: string;
};

export type StratmapEditorProps = {
  locale: string;
  userId: string;
  stratmapId: string;
  initialCanAdmin: boolean;
  initialStratmap: StratmapRecord;
  dictionary: Dictionary;
};

export type StratmapEditorMode = "view" | "edit";

export type ElementUpdate = (element: StratmapElement) => StratmapElement;
export type StateUpdate = (current: StratmapState) => StratmapState;

export const PING_DURATION_MS = 550;
export const MAP_SIZE = 1920;
export const MIN_VIEWPORT_SIZE = 640;
export const MAX_VIEWPORT_SIZE = MAP_SIZE;
export const STROKE_COLOR_OPTIONS = ["#39ff14", "#2563eb", "#dc2626", "#f59e0b", "#ffffff"];
export const PIXELS_PER_100_METERS = 190;
