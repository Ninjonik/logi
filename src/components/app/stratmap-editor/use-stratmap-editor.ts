"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { uploadFileToConvex } from "@/lib/client-uploads";
import { type StratmapArrowStyle, type StratmapElement, type StratmapElementAttachment, type StratmapFreehandElement, type StratmapLineElement, type StratmapPolygonElement, type StratmapShapeElement, type StratmapSlide, getHllStratmapCatalog, getHllStratmapCatalogGroups, getHllStratmapMapById, getHllStratmapMaps, parseStratmapState, stringifyStratmapState } from "@/lib/stratmaps";

import { MAX_VIEWPORT_SIZE, MIN_VIEWPORT_SIZE, PING_DURATION_MS, MAP_SIZE, type DragState, type StratmapEditorProps, type Tool, type Point, type Viewport } from "./types";
import { buildShapeBounds, clampPoint, clampViewport, createDefaultOverlays, filterLivePings, getActiveSlide, getAngleFromPoint, getBoundsCenter, getElementBounds, getElementsInBounds, getOverlayStrongpoints, getPointDistance, getPointerPoint, getStratmapMetaSignature, getSvgViewportMetrics, isAreaDrag, rotatePoint, updateSlide } from "./utils";

const getStratmapByIdReference = makeFunctionReference<"query">("stratmaps:getById");
const updateStratmapStateReference = makeFunctionReference<"mutation">("stratmaps:updateState");
const updateStratmapMetaReference = makeFunctionReference<"mutation">("stratmaps:updateMeta");
const pingStratmapReference = makeFunctionReference<"mutation">("stratmaps:ping");

export function useStratmapEditor({ userId, stratmapId, initialCanAdmin, initialStratmap, dictionary }: Omit<StratmapEditorProps, "locale">) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const liveData = useQuery(getStratmapByIdReference, { userId, stratmapId: stratmapId as never }) as { canAdmin: boolean; serverId: string; stratmap: typeof initialStratmap } | null | undefined;
  const updateStateMutation = useMutation(updateStratmapStateReference);
  const updateMeta = useMutation(updateStratmapMetaReference);
  const pingMutation = useMutation(pingStratmapReference);
  const [isPending, startTransition] = useTransition();
  const [tool, setTool] = useState<Tool>("select");
  const [strokeColor, setStrokeColor] = useState("#39ff14");
  const [fillColor, setFillColor] = useState("#39ff1433");
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [lineStartStyle, setLineStartStyle] = useState<StratmapArrowStyle>("none");
  const [lineEndStyle, setLineEndStyle] = useState<StratmapArrowStyle>("arrow");
  const [showLineDistance, setShowLineDistance] = useState(false);
  const [iconId, setIconId] = useState(getHllStratmapCatalog()[0]?.id ?? "garry");
  const [textValue, setTextValue] = useState("Text");
  const [textSize, setTextSize] = useState(48);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState(() => parseStratmapState(initialStratmap.state, initialStratmap.baseMapId).slides[0]?.id ?? "");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [title, setTitle] = useState(initialStratmap.title);
  const [description, setDescription] = useState(initialStratmap.description ?? "");
  const [baseMapId, setBaseMapId] = useState(initialStratmap.baseMapId);
  const [side, setSide] = useState(initialStratmap.side ?? "");
  const [strongpointId, setStrongpointId] = useState(initialStratmap.strongpointId ?? "");
  const [state, setState] = useState(() => parseStratmapState(initialStratmap.state, initialStratmap.baseMapId));
  const [isUploadingIconAttachments, setIsUploadingIconAttachments] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, size: MAP_SIZE });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRemoteUpdatedAtRef = useRef(initialStratmap.updatedAt);
  const lastRemoteMetaSignatureRef = useRef(getStratmapMetaSignature(initialStratmap));
  const undoStackRef = useRef<typeof state[]>([]);
  const redoStackRef = useRef<typeof state[]>([]);
  const historyCaptureActiveRef = useRef(false);

  const canAdmin = liveData?.canAdmin ?? initialCanAdmin;
  const stratmap = liveData?.stratmap ?? initialStratmap;
  const maps = getHllStratmapMaps();
  const catalogGroups = getHllStratmapCatalogGroups();
  const activeSlide = getActiveSlide(state, selectedSlideId);
  const selectedMap = getHllStratmapMapById(baseMapId || state.baseMapId);
  const overlayStrongpointIds = useMemo(() => getOverlayStrongpoints(activeSlide?.overlays ?? createDefaultOverlays(state.baseMapId), selectedMap?.strongpoints.map((point) => point.id) ?? []), [activeSlide?.overlays, selectedMap?.strongpoints, state.baseMapId]);
  const selectedElementId = selectedElementIds[0] ?? null;
  const selectedElement = useMemo(() => activeSlide?.elements.find((element) => element.id === selectedElementId) ?? null, [activeSlide, selectedElementId]);

  useEffect(() => {
    if (!liveData?.stratmap) return;
    const remoteMetaSignature = getStratmapMetaSignature(liveData.stratmap);
    if (lastRemoteMetaSignatureRef.current !== remoteMetaSignature) {
      lastRemoteMetaSignatureRef.current = remoteMetaSignature;
      setTitle(liveData.stratmap.title);
      setDescription(liveData.stratmap.description ?? "");
      setBaseMapId(liveData.stratmap.baseMapId);
      setSide(liveData.stratmap.side ?? "");
      setStrongpointId(liveData.stratmap.strongpointId ?? "");
    }
    if (lastRemoteUpdatedAtRef.current !== liveData.stratmap.updatedAt) {
      lastRemoteUpdatedAtRef.current = liveData.stratmap.updatedAt;
      const nextState = parseStratmapState(liveData.stratmap.state, liveData.stratmap.baseMapId);
      setState(nextState);
      undoStackRef.current = [];
      redoStackRef.current = [];
      historyCaptureActiveRef.current = false;
      setSelectedSlideId((current) => getActiveSlide(nextState, current)?.id ?? nextState.slides[0]?.id ?? "");
      setSelectedElementIds((current) => current.filter((id) => nextState.slides.some((slide) => slide.elements.some((element) => element.id === id))));
    }
  }, [liveData]);

  useEffect(() => {
    if (!canAdmin) return;
    if (!selectedSlideId && state.slides[0]) setSelectedSlideId(state.slides[0].id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const stateJson = stringifyStratmapState(state);
    if (stateJson === stratmap.state) return;
    saveTimerRef.current = setTimeout(() => { void updateStateMutation({ userId, stratmapId: stratmapId as never, state: stateJson }).catch((error) => { console.error(error); toast.error(dictionary.stratmaps.saveStateError); }); }, 450);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [canAdmin, state, stratmap.state, stratmapId, updateStateMutation, userId, selectedSlideId, dictionary.stratmaps.saveStateError]);

  useEffect(() => {
    if (!activeSlide?.pings.length) return;
    const nextExpiry = Math.min(...activeSlide.pings.map((ping) => new Date(ping.createdAt).getTime() + PING_DURATION_MS));
    const timeout = window.setTimeout(() => setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, pings: filterLivePings(slide, PING_DURATION_MS) }))), Math.max(0, nextExpiry - Date.now()) + 8);
    return () => window.clearTimeout(timeout);
  }, [activeSlide?.pings, selectedSlideId]);

  function captureHistorySnapshot(snapshot: typeof state) {
    undoStackRef.current.push(structuredClone(snapshot));
    if (undoStackRef.current.length > 80) undoStackRef.current.shift();
    redoStackRef.current = [];
  }
  function beginHistoryCapture() { if (!historyCaptureActiveRef.current) { captureHistorySnapshot(state); historyCaptureActiveRef.current = true; } }
  function endHistoryCapture() { historyCaptureActiveRef.current = false; }
  function discardHistoryCapture(revertState: boolean) {
    if (!historyCaptureActiveRef.current) return;
    const previous = undoStackRef.current.pop();
    historyCaptureActiveRef.current = false;
    if (revertState && previous) {
      setState(previous);
    }
  }
  function applyStateChange(updater: (current: typeof state) => typeof state) { captureHistorySnapshot(state); setState((current) => updater(current)); }
  function updateSelection(nextIds: string[]) { setSelectedElementIds(Array.from(new Set(nextIds))); }
  function setElementUpdater(elementId: string, updater: (element: StratmapElement) => StratmapElement) { applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.map((element) => element.id === elementId ? updater(element) : element) }))); }
  function undo() { const previous = undoStackRef.current.pop(); if (!previous) return; redoStackRef.current.push(structuredClone(state)); setState(previous); setSelectedSlideId((current) => getActiveSlide(previous, current)?.id ?? previous.slides[0]?.id ?? ""); }
  function redo() { const next = redoStackRef.current.pop(); if (!next) return; undoStackRef.current.push(structuredClone(state)); setState(next); setSelectedSlideId((current) => getActiveSlide(next, current)?.id ?? next.slides[0]?.id ?? ""); }
  function handleOverlayChange(next: Partial<typeof activeSlide.overlays>) { if (canAdmin) applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, overlays: { ...slide.overlays, ...next } }))); }
  function toggleStrongpoint(pointId: string) { if (!canAdmin || !activeSlide) return; const visible = activeSlide.overlays.visibleStrongpointIds.includes(pointId); handleOverlayChange({ showAllStrongpoints: false, visibleStrongpointIds: visible ? activeSlide.overlays.visibleStrongpointIds.filter((id) => id !== pointId) : [...activeSlide.overlays.visibleStrongpointIds, pointId] }); }
  function zoomTo(nextSize: number, anchor?: Point) { setViewport((current) => { const clampedSize = Math.max(MIN_VIEWPORT_SIZE, Math.min(MAX_VIEWPORT_SIZE, nextSize)); const centerX = anchor ? anchor.x : current.x + current.size / 2; const centerY = anchor ? anchor.y : current.y + current.size / 2; const scale = clampedSize / current.size; return clampViewport({ x: centerX - (centerX - current.x) * scale, y: centerY - (centerY - current.y) * scale, size: clampedSize }); }); }
  function removeSelectedElements() { if (!selectedElementIds.length) return; const selectedIds = new Set(selectedElementIds); applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.filter((element) => !selectedIds.has(element.id)) }))); updateSelection([]); }
  function handleSelectedElementChange(updater: (element: StratmapElement) => StratmapElement) { if (selectedElementId) setElementUpdater(selectedElementId, updater); }
  function addSlide() { const nextSlide: StratmapSlide = { id: crypto.randomUUID(), name: `Slide ${state.slides.length + 1}`, overlays: createDefaultOverlays(state.baseMapId), elements: [], pings: [] }; applyStateChange((current) => ({ ...current, slides: [...current.slides, nextSlide] })); setSelectedSlideId(nextSlide.id); }
  function duplicateSlide() { if (!activeSlide) return; const nextSlide: StratmapSlide = { ...structuredClone(activeSlide), id: crypto.randomUUID(), name: `${activeSlide.name} Copy`, pings: [] }; applyStateChange((current) => ({ ...current, slides: [...current.slides, nextSlide] })); setSelectedSlideId(nextSlide.id); }
  function deleteSlide() { if (state.slides.length <= 1 || !activeSlide) return; const nextSlides = state.slides.filter((slide) => slide.id !== activeSlide.id); applyStateChange((current) => ({ ...current, slides: nextSlides })); setSelectedSlideId(nextSlides[0]?.id ?? ""); updateSelection([]); }
  function handleBaseMapChange(value: string) { setBaseMapId(value); setStrongpointId(""); setState((current) => ({ ...current, baseMapId: value, slides: current.slides.map((slide) => ({ ...slide, overlays: createDefaultOverlays(value) })) })); }
  function saveMeta() { startTransition(async () => { try { const normalizedBaseMapId = baseMapId || maps[0]?.id || "carentan"; if (normalizedBaseMapId !== state.baseMapId) { setState((current) => ({ ...current, baseMapId: normalizedBaseMapId, slides: current.slides.map((slide) => ({ ...slide, overlays: createDefaultOverlays(normalizedBaseMapId) })) })); } await updateMeta({ userId, stratmapId: stratmapId as never, title: title.trim(), description: description.trim() || undefined, baseMapId: normalizedBaseMapId, side: side.trim() || undefined, strongpointId: strongpointId || undefined, eventId: stratmap.eventId as never }); toast.success(dictionary.stratmaps.detailsSaved); } catch (error) { console.error(error); toast.error(dictionary.stratmaps.saveDetailsError); } }); }

  function finalizePolygon(points: Point[]) {
    if (points.length < 3) return;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const nextElement: StratmapPolygonElement = {
      id: crypto.randomUUID(),
      kind: "polygon",
      x: Math.min(...xs),
      y: Math.min(...ys),
      points,
      strokeColor,
      strokeWidth,
      fillColor,
      fillOpacity: 0.2,
      strokeStyle: lineStyle,
    };
    setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] })));
    endHistoryCapture();
    setDragState(null);
  }

  function finalizeMeasure(points: Point[]) {
    if (points.length < 2) return;
    const nextElement: StratmapLineElement = {
      id: crypto.randomUUID(),
      kind: "line",
      x: points[0]!.x,
      y: points[0]!.y,
      points,
      strokeColor,
      strokeWidth,
      strokeStyle: lineStyle,
      startStyle: "none",
      endStyle: "none",
      showDistance: true,
    };
    setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] })));
    endHistoryCapture();
    setDragState(null);
  }

  function translateElement(element: StratmapElement, deltaX: number, deltaY: number): StratmapElement {
    if (element.kind === "line" || element.kind === "freehand" || element.kind === "polygon") {
      return {
        ...element,
        x: element.x + deltaX,
        y: element.y + deltaY,
        points: element.points.map((point) => ({ x: point.x + deltaX, y: point.y + deltaY })),
      };
    }

    return {
      ...element,
      x: element.x + deltaX,
      y: element.y + deltaY,
    };
  }

  function rotateElement(element: StratmapElement, center: Point, angleDeg: number): StratmapElement {
    if (element.kind === "line" || element.kind === "freehand" || element.kind === "polygon") {
      const rotatedPoints = element.points.map((point) => rotatePoint(point, center, angleDeg));
      const rotatedOrigin = rotatePoint({ x: element.x, y: element.y }, center, angleDeg);
      return {
        ...element,
        x: rotatedOrigin.x,
        y: rotatedOrigin.y,
        points: rotatedPoints,
      };
    }

    if (element.kind === "rectangle" || element.kind === "ellipse") {
      const elementCenter = getBoundsCenter(getElementBounds(element));
      const rotatedCenter = rotatePoint(elementCenter, center, angleDeg);
      return {
        ...element,
        x: rotatedCenter.x - element.width / 2,
        y: rotatedCenter.y - element.height / 2,
        rotation: (element.rotation ?? 0) + angleDeg,
      };
    }

    const rotatedPosition = rotatePoint({ x: element.x, y: element.y }, center, angleDeg);
    return {
      ...element,
      x: rotatedPosition.x,
      y: rotatedPosition.y,
      rotation: (element.rotation ?? 0) + angleDeg,
    };
  }

  function handleBoardContextMenu(event: ReactMouseEvent<SVGSVGElement>) {
    event.preventDefault();

    if (!dragState) {
      if (tool !== "select") {
        setTool("select");
      }
      return;
    }

    const dragMode = dragState.mode;

    if (dragMode === "pan") {
      setDragState(null);
      return;
    }

    if (dragMode === "rotate") {
      return;
    }

    if (dragMode === "polygon") {
      if (dragState.points.length > 1) {
        const nextPoints = dragState.points.slice(0, -1);
        setDragState(nextPoints.length ? { ...dragState, points: nextPoints, current: nextPoints[nextPoints.length - 1]! } : null);
      } else {
        discardHistoryCapture(false);
        setDragState(null);
        setTool("select");
      }
      return;
    }

    if (dragMode === "measure") {
      if (dragState.points.length > 1) {
        const nextPoints = dragState.points.slice(0, -1);
        setDragState(nextPoints.length ? { ...dragState, points: nextPoints, current: nextPoints[nextPoints.length - 1]! } : null);
      } else {
        discardHistoryCapture(false);
        setDragState(null);
        setTool("select");
      }
      return;
    }

    discardHistoryCapture(dragMode === "move");
    setDragState(null);
    if (dragMode !== "move" && tool !== "select") {
      setTool("select");
    }
  }

  function handleBoardWheel(event: ReactWheelEvent<SVGSVGElement>) { if (!svgRef.current) return; event.preventDefault(); const anchor = clampPoint(getPointerPoint(event as unknown as ReactPointerEvent<SVGSVGElement>, svgRef.current, viewport)); zoomTo(viewport.size * (event.deltaY > 0 ? 1.12 : 0.88), anchor); }
  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) { if (!svgRef.current || !activeSlide) return; const point = clampPoint(getPointerPoint(event, svgRef.current, viewport)); if (event.button === 2) { event.preventDefault(); if (tool === "select" && selectedElementIds.length && canAdmin) { const selectedElements = activeSlide.elements.filter((entry) => selectedElementIds.includes(entry.id)); if (selectedElements.length) { beginHistoryCapture(); const selectionBounds = selectedElements.reduce<{ x: number; y: number; width: number; height: number } | null>((current, element) => { const bounds = getElementBounds(element); if (!current) return bounds; const left = Math.min(current.x, bounds.x); const top = Math.min(current.y, bounds.y); const right = Math.max(current.x + current.width, bounds.x + bounds.width); const bottom = Math.max(current.y + current.height, bounds.y + bounds.height); return { x: left, y: top, width: right - left, height: bottom - top }; }, null); if (selectionBounds) { const center = getBoundsCenter(selectionBounds); setDragState({ mode: "rotate", elementIds: selectedElementIds, center, startAngle: getAngleFromPoint(point, center), snapshots: selectedElements.map((entry) => ({ id: entry.id, element: structuredClone(entry) })) }); } } } return; } svgRef.current.setPointerCapture(event.pointerId); if (event.button === 1 || (event.button === 0 && tool === "select" && viewport.size < MAP_SIZE)) { event.preventDefault(); if (event.button === 0 && tool === "select") updateSelection([]); setDragState({ mode: "pan", origin: { x: event.clientX, y: event.clientY }, viewport }); return; } if (!canAdmin) return; if (tool === "icon") { const catalogItem = getHllStratmapCatalog().find((item) => item.id === iconId); if (!catalogItem) return; applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, { id: crypto.randomUUID(), kind: "icon", x: point.x, y: point.y, size: 74, iconId: catalogItem.id, color: strokeColor, note: "", attachments: [] }] }))); return; } if (tool === "text") { applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, { id: crypto.randomUUID(), kind: "text", x: point.x, y: point.y, text: textValue.trim() || "Text", fontSize: textSize, width: 360, color: strokeColor }] }))); return; } if (tool === "ping") { const nextState = updateSlide(state, selectedSlideId, (slide) => ({ ...slide, pings: [...slide.pings, { id: crypto.randomUUID(), x: point.x, y: point.y, color: strokeColor, createdAt: new Date().toISOString() }] })); setState(nextState); void pingMutation({ userId, stratmapId: stratmapId as never, state: stringifyStratmapState(nextState) }).catch(console.error); return; } if (tool === "freehand") { beginHistoryCapture(); setDragState({ mode: "freehand", points: [point] }); return; } if (tool === "line") { beginHistoryCapture(); setDragState({ mode: "line", start: point, current: point }); return; } if (tool === "polygon") { if (dragState?.mode !== "polygon") { beginHistoryCapture(); setDragState({ mode: "polygon", points: [point], current: point }); return; } if (dragState.points.length >= 3 && getPointDistance(point, dragState.points[0]!) <= 56) { finalizePolygon(dragState.points); return; } setDragState({ ...dragState, points: [...dragState.points, point], current: point }); return; } if (tool === "measure") { if (dragState?.mode !== "measure") { beginHistoryCapture(); setDragState({ mode: "measure", points: [point], current: point }); return; } const nextPoints = [...dragState.points, point]; if (event.detail >= 2) { finalizeMeasure(nextPoints); return; } setDragState({ ...dragState, points: nextPoints, current: point }); return; } if (tool === "rectangle") { beginHistoryCapture(); setDragState({ mode: "rectangle", start: point, current: point }); return; } if (tool === "ellipse") { beginHistoryCapture(); setDragState({ mode: "ellipse", start: point, current: point }); return; } if (tool === "select") { updateSelection([]); setDragState({ mode: "selectArea", start: point, current: point }); return; } if (tool === "delete") setDragState({ mode: "deleteArea", start: point, current: point }); }
  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) { if (!svgRef.current || !dragState) return; const point = clampPoint(getPointerPoint(event, svgRef.current, viewport)); if (dragState.mode === "pan") { const { size } = getSvgViewportMetrics(svgRef.current); const scale = dragState.viewport.size / size; setViewport(clampViewport({ ...dragState.viewport, x: dragState.viewport.x - (event.clientX - dragState.origin.x) * scale, y: dragState.viewport.y - (event.clientY - dragState.origin.y) * scale })); return; } if (!canAdmin) return; if (dragState.mode === "move") { const deltaX = point.x - dragState.origin.x; const deltaY = point.y - dragState.origin.y; setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.map((element) => { const snapshot = dragState.snapshots.find((entry) => entry.id === element.id); return snapshot ? translateElement(snapshot.element, deltaX, deltaY) : element; }) }))); return; } if (dragState.mode === "rotate") { const angle = getAngleFromPoint(point, dragState.center) - dragState.startAngle; setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.map((element) => { const snapshot = dragState.snapshots.find((entry) => entry.id === element.id); return snapshot ? rotateElement(snapshot.element, dragState.center, angle) : element; }) }))); return; } if (dragState.mode === "freehand") { setDragState({ ...dragState, points: [...dragState.points, point] }); return; } if (dragState.mode === "polygon" || dragState.mode === "measure") { setDragState({ ...dragState, current: point }); return; } setDragState({ ...dragState, current: point }); }
  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) { svgRef.current?.releasePointerCapture(event.pointerId); if (!dragState) return; if (dragState.mode === "pan" || dragState.mode === "rotate") { endHistoryCapture(); setDragState(null); return; } if (!canAdmin) return; if (dragState.mode === "polygon" || dragState.mode === "measure") { return; } if (dragState.mode === "freehand") { const nextElement: StratmapFreehandElement = { id: crypto.randomUUID(), kind: "freehand", x: dragState.points[0]?.x ?? 0, y: dragState.points[0]?.y ?? 0, points: dragState.points, strokeColor, strokeWidth, strokeStyle: lineStyle }; setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] }))); } if (dragState.mode === "line") { const nextElement: StratmapLineElement = { id: crypto.randomUUID(), kind: "line", x: dragState.start.x, y: dragState.start.y, points: [dragState.start, dragState.current], strokeColor, strokeWidth, strokeStyle: lineStyle, startStyle: lineStartStyle, endStyle: lineEndStyle, showDistance: showLineDistance }; setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] }))); } if (dragState.mode === "rectangle" || dragState.mode === "ellipse") { const bounds = buildShapeBounds(dragState.start, dragState.current); const nextElement: StratmapShapeElement = { id: crypto.randomUUID(), kind: dragState.mode, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, strokeColor, strokeWidth, fillColor, fillOpacity: 0.2, strokeStyle: lineStyle }; setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] }))); } if (dragState.mode === "selectArea") { if (isAreaDrag(dragState)) updateSelection(getElementsInBounds(activeSlide.elements, buildShapeBounds(dragState.start, dragState.current))); setDragState(null); return; } if (dragState.mode === "deleteArea") { if (isAreaDrag(dragState)) { const ids = new Set(getElementsInBounds(activeSlide.elements, buildShapeBounds(dragState.start, dragState.current))); if (ids.size) { applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.filter((element) => !ids.has(element.id)) }))); setSelectedElementIds((current) => current.filter((id) => !ids.has(id))); } } setDragState(null); return; } endHistoryCapture(); setDragState(null); }
  function startMove(elementId: string, event: ReactPointerEvent<SVGGElement>) { if (!svgRef.current || !activeSlide) return; const point = getPointerPoint(event as unknown as ReactPointerEvent<SVGSVGElement>, svgRef.current, viewport); const element = activeSlide.elements.find((entry) => entry.id === elementId); if (!element) return; event.stopPropagation(); if (tool === "icon" || tool === "delete") { applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.filter((entry) => entry.id !== elementId) }))); setSelectedElementIds((current) => current.filter((id) => id !== elementId)); return; } if (tool !== "select") return; const nextSelection = selectedElementIds.includes(elementId) ? selectedElementIds : [elementId]; updateSelection(nextSelection); if (!canAdmin) return; if (event.button === 2) { beginHistoryCapture(); const selectedElements = activeSlide.elements.filter((entry) => nextSelection.includes(entry.id)); const selectionBounds = selectedElements.reduce<{ x: number; y: number; width: number; height: number } | null>((current, entry) => { const bounds = getElementBounds(entry); if (!current) return bounds; const left = Math.min(current.x, bounds.x); const top = Math.min(current.y, bounds.y); const right = Math.max(current.x + current.width, bounds.x + bounds.width); const bottom = Math.max(current.y + current.height, bounds.y + bounds.height); return { x: left, y: top, width: right - left, height: bottom - top }; }, null); if (selectionBounds) { const center = getBoundsCenter(selectionBounds); setDragState({ mode: "rotate", elementIds: nextSelection, center, startAngle: getAngleFromPoint(point, center), snapshots: selectedElements.map((entry) => ({ id: entry.id, element: structuredClone(entry) })) }); } return; } beginHistoryCapture(); setDragState({ mode: "move", elementIds: nextSelection, origin: point, snapshots: activeSlide.elements.filter((entry) => nextSelection.includes(entry.id)).map((entry) => ({ id: entry.id, element: structuredClone(entry) })) }); }
  async function handleSelectedIconAttachmentUpload(event: ChangeEvent<HTMLInputElement>) { const files = event.target.files; if (!files?.length || !selectedElementId) return; setIsUploadingIconAttachments(true); try { const uploaded: StratmapElementAttachment[] = []; for (const file of Array.from(files)) { const result = await uploadFileToConvex(file, { prepareUploadError: "Unable to prepare the image upload.", uploadFileError: "Unable to upload the image.", readFileUrlError: "Unable to read the uploaded image URL." }); uploaded.push({ url: result.url, filename: file.name, contentType: file.type || undefined, description: "" }); } setElementUpdater(selectedElementId, (element) => element.kind === "icon" ? { ...element, attachments: [...(element.attachments ?? []), ...uploaded] } : element); toast.success(dictionary.stratmaps.imagesAttached); } catch (error) { console.error(error); toast.error(error instanceof Error ? error.message : dictionary.stratmaps.uploadImagesError); } finally { setIsUploadingIconAttachments(false); event.target.value = ""; } }

  return {
    rootRef, svgRef, canAdmin, isPending, tool, strokeColor, fillColor, strokeWidth, lineStyle, lineStartStyle, lineEndStyle, showLineDistance, iconId, textValue, textSize, selectedElementIds, hoveredElementId, selectedSlideId, dragState, viewport, title, description, baseMapId, side, strongpointId, state, isUploadingIconAttachments, activeSlide, selectedMap, catalogGroups, overlayStrongpointIds, selectedElement, canUndo: !!undoStackRef.current.length, canRedo: !!redoStackRef.current.length,
    setTool, setStrokeColor, setFillColor, setStrokeWidth, setLineStyle, setLineStartStyle, setLineEndStyle, setShowLineDistance, setIconId, setTextValue, setTextSize, setTitle, setDescription, setSide, setStrongpointId, setSelectedSlideId,
    saveMeta, addSlide, duplicateSlide, deleteSlide, handleOverlayChange, toggleStrongpoint, undo, redo, zoomIn: () => zoomTo(viewport.size * 0.85), zoomOut: () => zoomTo(viewport.size * 1.15), resetZoom: () => setViewport({ x: 0, y: 0, size: MAP_SIZE }), handleBoardWheel, handleBoardContextMenu, handlePointerDown, handlePointerMove, handlePointerUp, startMove, removeSelectedElements, handleSelectedElementChange, handleSelectedIconAttachmentUpload, handleBaseMapChange, setHoveredElementId,
  };
}
