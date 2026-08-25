"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, SetStateAction, WheelEvent as ReactWheelEvent } from "react";
import { makeFunctionReference } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { uploadFileToConvex } from "@/lib/client-uploads";
import {
  type StratmapArrowStyle,
  type StratmapElement,
  type StratmapElementAttachment,
  type StratmapFreehandElement,
  type StratmapLineElement,
  type StratmapPolygonElement,
  type StratmapShapeElement,
  type StratmapSlide,
  getHllStratmapCatalog,
  getHllStratmapCatalogGroups,
  getHllStratmapMapById,
  getHllStratmapMaps,
  parseStratmapState,
  stringifyStratmapState,
} from "@/lib/stratmaps";

import { MAP_SIZE, PING_DURATION_MS, type DragState, type Point, type StratmapEditorMode, type StratmapEditorProps, type Tool, type Viewport } from "./types";
import { decideRemoteState } from "./state-sync";
import { buildShapeBounds, clampPoint, clampViewport, createDefaultOverlays, createViewport, filterLivePings, getActiveSlide, getAngleFromPoint, getBoundsCenter, getCanvasSize, getElementBounds, getElementsInBounds, getOverlayStrongpoints, getPointDistance, getPointerPoint, getStratmapMetaSignature, getSvgViewportMetrics, isAreaDrag, rotatePoint, updateSlide, zoomViewport } from "./utils";

const getStratmapByIdReference = makeFunctionReference<"query">("stratmaps:getById");
const updateStratmapStateReference = makeFunctionReference<"mutation">("stratmaps:updateState");
const updateStratmapMetaReference = makeFunctionReference<"mutation">("stratmaps:updateMeta");
const AUTOSAVE_DEBOUNCE_MS = 400;

export function useStratmapEditor({ userId, stratmapId, initialCanAdmin, initialStratmap, dictionary }: Omit<StratmapEditorProps, "locale">, editorMode: StratmapEditorMode) {
  const initialState = useMemo(() => parseStratmapState(initialStratmap.state, initialStratmap.baseMapId), [initialStratmap.baseMapId, initialStratmap.state]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const liveData = useQuery(getStratmapByIdReference, { userId, stratmapId: stratmapId as never }) as { canAdmin: boolean; serverId: string; stratmap: typeof initialStratmap } | null | undefined;
  const updateStateMutation = useMutation(updateStratmapStateReference);
  const updateMeta = useMutation(updateStratmapMetaReference);
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
  const [selectedSlideId, setSelectedSlideId] = useState(initialState.slides[0]?.id ?? "");
  const [mode, setMode] = useState<StratmapEditorMode>(editorMode);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [title, setTitle] = useState(initialStratmap.title);
  const [description, setDescription] = useState(initialStratmap.description ?? "");
  const [baseMapId, setBaseMapId] = useState(initialStratmap.baseMapId);
  const [side, setSide] = useState(initialStratmap.side ?? "");
  const [strongpointId, setStrongpointId] = useState(initialStratmap.strongpointId ?? "");
  const [state, setReactState] = useState(initialState);
  const [isUploadingIconAttachments, setIsUploadingIconAttachments] = useState(false);
  const [isCreateSlideModalOpen, setIsCreateSlideModalOpen] = useState(false);
  const [newSlideName, setNewSlideName] = useState("");
  const [pendingSlideBackground, setPendingSlideBackground] = useState<StratmapSlide["background"] | null>(null);
  const [isUploadingSlideBackground, setIsUploadingSlideBackground] = useState(false);
  const [viewport, setViewport] = useState<Viewport>(() => createViewport(initialState.slides[0]?.background));
  const stateRef = useRef(initialState);
  const acknowledgedStateJsonRef = useRef(stringifyStratmapState(initialState));
  const observedRemoteStateJsonRef = useRef(stringifyStratmapState(initialState));
  const submittedStateJsonsRef = useRef(new Set<string>());
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastRemoteMetaSignatureRef = useRef(getStratmapMetaSignature(initialStratmap));
  const undoStackRef = useRef<typeof state[]>([]);
  const redoStackRef = useRef<typeof state[]>([]);
  const historyCaptureActiveRef = useRef(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const canAdmin = liveData?.canAdmin ?? initialCanAdmin;
  const canEdit = canAdmin && mode === "edit";
  const stratmap = liveData?.stratmap ?? initialStratmap;
  const maps = getHllStratmapMaps();
  const catalogGroups = getHllStratmapCatalogGroups();
  const activeSlide = getActiveSlide(state, selectedSlideId);
  const selectedMap = getHllStratmapMapById(baseMapId || state.baseMapId);
  const overlayStrongpointIds = useMemo(() => getOverlayStrongpoints(activeSlide?.overlays ?? createDefaultOverlays(state.baseMapId), selectedMap?.strongpoints.map((point) => point.id) ?? []), [activeSlide?.overlays, selectedMap?.strongpoints, state.baseMapId]);
  const selectedElementId = selectedElementIds[0] ?? null;
  const selectedElement = useMemo(() => activeSlide?.elements.find((element) => element.id === selectedElementId) ?? null, [activeSlide, selectedElementId]);
  const canvas = useMemo(() => getCanvasSize(activeSlide?.background), [activeSlide?.background]);

  function setState(update: SetStateAction<typeof initialState>) {
    const nextState = typeof update === "function" ? update(stateRef.current) : update;
    stateRef.current = nextState;
    setReactState(nextState);
  }

  useEffect(() => {
    setMode(editorMode);
  }, [editorMode]);

  useEffect(() => {
    setViewport((current) => clampViewport(current, activeSlide?.background));
  }, [activeSlide?.background]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
    const nextState = parseStratmapState(liveData.stratmap.state, liveData.stratmap.baseMapId);
    const remoteJson = stringifyStratmapState(nextState);
    if (observedRemoteStateJsonRef.current === remoteJson) return;
    observedRemoteStateJsonRef.current = remoteJson;

    const decision = decideRemoteState({
      remoteJson,
      currentJson: stringifyStratmapState(stateRef.current),
      acknowledgedJson: acknowledgedStateJsonRef.current,
      submittedJsons: submittedStateJsonsRef.current,
    });

    if (decision === "acknowledge" || decision === "own-echo") {
      acknowledgedStateJsonRef.current = remoteJson;
      for (const submittedJson of submittedStateJsonsRef.current) {
        submittedStateJsonsRef.current.delete(submittedJson);
        if (submittedJson === remoteJson) break;
      }
      return;
    }
    if (decision === "preserve-local") return;

    acknowledgedStateJsonRef.current = remoteJson;
    setState(nextState);
    undoStackRef.current = [];
    redoStackRef.current = [];
    historyCaptureActiveRef.current = false;
    setHistoryState({ canUndo: false, canRedo: false });
    setSelectedSlideId((current) => getActiveSlide(nextState, current)?.id ?? nextState.slides[0]?.id ?? "");
    setSelectedElementIds((current) => current.filter((id) => nextState.slides.some((slide) => slide.elements.some((element) => element.id === id))));
  }, [liveData]);

  useEffect(() => {
    if (!canEdit) return;
    if (!selectedSlideId && state.slides[0]) setSelectedSlideId(state.slides[0].id);
  }, [canEdit, selectedSlideId, state.slides]);

  useEffect(() => {
    if (!canEdit) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void requestSave(), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [canEdit, state]);

  async function requestSave() {
    if (!canEdit) return;
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    const stateJson = stringifyStratmapState(stateRef.current);
    if (stateJson === acknowledgedStateJsonRef.current) return;

    saveInFlightRef.current = true;
    saveQueuedRef.current = false;
    submittedStateJsonsRef.current.add(stateJson);
    let succeeded = false;
    try {
      await updateStateMutation({ userId, stratmapId: stratmapId as never, state: stateJson });
      acknowledgedStateJsonRef.current = stateJson;
      succeeded = true;
    } catch (error) {
      console.error(error);
      submittedStateJsonsRef.current.delete(stateJson);
      toast.error(dictionary.stratmaps.saveStateError);
    } finally {
      saveInFlightRef.current = false;
      const hasNewerState = stringifyStratmapState(stateRef.current) !== stateJson;
      if (succeeded && (saveQueuedRef.current || hasNewerState)) {
        saveQueuedRef.current = false;
        window.setTimeout(() => void requestSave(), 0);
      }
    }
  }

  useEffect(() => {
    if (!activeSlide?.pings.length) return;
    const nextExpiry = Math.min(...activeSlide.pings.map((ping) => new Date(ping.createdAt).getTime() + PING_DURATION_MS));
    const timeout = window.setTimeout(() => {
      setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, pings: filterLivePings(slide, PING_DURATION_MS) })));
    }, Math.max(0, nextExpiry - Date.now()) + 8);
    return () => window.clearTimeout(timeout);
  }, [activeSlide?.pings, selectedSlideId]);

  function captureHistorySnapshot(snapshot: typeof state) {
    undoStackRef.current.push(structuredClone(snapshot));
    if (undoStackRef.current.length > 80) undoStackRef.current.shift();
    redoStackRef.current = [];
    setHistoryState({ canUndo: undoStackRef.current.length > 0, canRedo: false });
  }

  function beginHistoryCapture() {
    if (!historyCaptureActiveRef.current) {
      captureHistorySnapshot(stateRef.current);
      historyCaptureActiveRef.current = true;
    }
  }

  function endHistoryCapture() {
    historyCaptureActiveRef.current = false;
  }

  function discardHistoryCapture(revertState: boolean) {
    if (!historyCaptureActiveRef.current) return;
    const previous = undoStackRef.current.pop();
    historyCaptureActiveRef.current = false;
    setHistoryState({ canUndo: undoStackRef.current.length > 0, canRedo: redoStackRef.current.length > 0 });
    if (revertState && previous) setState(previous);
  }

  function applyStateChange(updater: (current: typeof state) => typeof state) {
    captureHistorySnapshot(stateRef.current);
    setState((current) => updater(current));
  }

  function updateSelection(nextIds: string[]) {
    setSelectedElementIds(Array.from(new Set(nextIds)));
  }

  function setElementUpdater(elementId: string, updater: (element: StratmapElement) => StratmapElement) {
    applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.map((element) => element.id === elementId ? updater(element) : element) })));
  }

  function undo() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(structuredClone(stateRef.current));
    setHistoryState({ canUndo: undoStackRef.current.length > 0, canRedo: true });
    setState(previous);
    setSelectedSlideId((current) => getActiveSlide(previous, current)?.id ?? previous.slides[0]?.id ?? "");
  }

  function redo() {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(structuredClone(stateRef.current));
    setHistoryState({ canUndo: true, canRedo: redoStackRef.current.length > 0 });
    setState(next);
    setSelectedSlideId((current) => getActiveSlide(next, current)?.id ?? next.slides[0]?.id ?? "");
  }

  function handleOverlayChange(next: Partial<typeof activeSlide.overlays>) {
    if (!activeSlide) return;
    applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, overlays: { ...slide.overlays, ...next } })));
  }

  function toggleStrongpoint(pointId: string) {
    if (!activeSlide) return;
    const visible = activeSlide.overlays.visibleStrongpointIds.includes(pointId);
    handleOverlayChange({
      showAllStrongpoints: false,
      visibleStrongpointIds: visible ? activeSlide.overlays.visibleStrongpointIds.filter((id) => id !== pointId) : [...activeSlide.overlays.visibleStrongpointIds, pointId],
    });
  }

  function zoomBy(factor: number, anchorForViewport?: (current: Viewport) => Point) {
    setViewport((current) => {
      const anchor = anchorForViewport?.(current) ?? { x: current.x + current.width / 2, y: current.y + current.height / 2 };
      return zoomViewport(current, factor, anchor, activeSlide?.background);
    });
  }

  function removeSelectedElements() {
    if (!selectedElementIds.length) return;
    const selectedIds = new Set(selectedElementIds);
    applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.filter((element) => !selectedIds.has(element.id)) })));
    updateSelection([]);
  }

  function handleSelectedElementChange(updater: (element: StratmapElement) => StratmapElement) {
    if (selectedElementId) setElementUpdater(selectedElementId, updater);
  }

  function addSlide() {
    setNewSlideName(`Slide ${state.slides.length + 1}`);
    setPendingSlideBackground(null);
    setIsCreateSlideModalOpen(true);
  }

  function closeCreateSlideModal() {
    if (isUploadingSlideBackground) return;
    setIsCreateSlideModalOpen(false);
    setNewSlideName("");
    setPendingSlideBackground(null);
  }

  function confirmCreateSlide() {
    const nextSlide: StratmapSlide = {
      id: crypto.randomUUID(),
      name: newSlideName.trim() || `Slide ${state.slides.length + 1}`,
      background: pendingSlideBackground ?? { kind: "map" },
      overlays: createDefaultOverlays(state.baseMapId),
      elements: [],
      pings: [],
    };
    applyStateChange((current) => ({ ...current, slides: [...current.slides, nextSlide] }));
    setSelectedSlideId(nextSlide.id);
    setViewport(createViewport(nextSlide.background));
    closeCreateSlideModal();
  }

  function duplicateSlide() {
    if (!activeSlide) return;
    const nextSlide: StratmapSlide = { ...structuredClone(activeSlide), id: crypto.randomUUID(), name: `${activeSlide.name} Copy`, pings: [] };
    applyStateChange((current) => ({ ...current, slides: [...current.slides, nextSlide] }));
    setSelectedSlideId(nextSlide.id);
  }

  function renameSlide(slideId: string, name: string) {
    const nextName = name.trim() || "Slide";
    applyStateChange((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === slideId ? { ...slide, name: nextName } : slide) }));
  }

  function moveSlide(slideId: string, direction: -1 | 1) {
    applyStateChange((current) => {
      const index = current.slides.findIndex((slide) => slide.id === slideId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.slides.length) return current;
      const slides = current.slides.slice();
      [slides[index], slides[target]] = [slides[target]!, slides[index]!];
      return { ...current, slides: slides.map((slide, slideIndex) => ({ ...slide, name: slide.name || `Slide ${slideIndex + 1}` })) };
    });
  }

  function deleteSlide() {
    if (state.slides.length <= 1 || !activeSlide) return;
    const nextSlides = state.slides.filter((slide) => slide.id !== activeSlide.id);
    applyStateChange((current) => ({ ...current, slides: nextSlides }));
    setSelectedSlideId(nextSlides[0]?.id ?? "");
    updateSelection([]);
  }

  function handleBaseMapChange(value: string) {
    setBaseMapId(value);
    setStrongpointId("");
    setState((current) => ({ ...current, baseMapId: value, slides: current.slides.map((slide) => ({ ...slide, overlays: createDefaultOverlays(value) })) }));
  }

  function saveMeta() {
    startTransition(async () => {
      try {
        const normalizedBaseMapId = baseMapId || maps[0]?.id || "carentan";
        if (normalizedBaseMapId !== state.baseMapId) {
          setState((current) => ({ ...current, baseMapId: normalizedBaseMapId, slides: current.slides.map((slide) => ({ ...slide, overlays: createDefaultOverlays(normalizedBaseMapId) })) }));
        }
        await updateMeta({ userId, stratmapId: stratmapId as never, title: title.trim(), description: description.trim() || undefined, baseMapId: normalizedBaseMapId, side: side.trim() || undefined, strongpointId: strongpointId || undefined, eventId: stratmap.eventId as never });
        toast.success(dictionary.stratmaps.detailsSaved);
      } catch (error) {
        console.error(error);
        toast.error(dictionary.stratmaps.saveDetailsError);
      }
    });
  }

  function finalizePolygon(points: Point[]) {
    if (points.length < 3) return;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const nextElement: StratmapPolygonElement = { id: crypto.randomUUID(), kind: "polygon", x: Math.min(...xs), y: Math.min(...ys), points, strokeColor, strokeWidth, fillColor, fillOpacity: 0.2, strokeStyle: lineStyle };
    setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] })));
    endHistoryCapture();
    setDragState(null);
  }

  function finalizeMeasure(points: Point[]) {
    if (points.length < 2) return;
    const nextElement: StratmapLineElement = { id: crypto.randomUUID(), kind: "line", x: points[0]!.x, y: points[0]!.y, points, strokeColor, strokeWidth, strokeStyle: lineStyle, startStyle: "none", endStyle: "none", showDistance: true };
    setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] })));
    endHistoryCapture();
    setDragState(null);
  }

  function translateElement(element: StratmapElement, deltaX: number, deltaY: number): StratmapElement {
    if (element.kind === "line" || element.kind === "freehand" || element.kind === "polygon") {
      return { ...element, x: element.x + deltaX, y: element.y + deltaY, points: element.points.map((point) => ({ x: point.x + deltaX, y: point.y + deltaY })) };
    }
    return { ...element, x: element.x + deltaX, y: element.y + deltaY };
  }

  function rotateElement(element: StratmapElement, center: Point, angleDeg: number): StratmapElement {
    if (element.kind === "line" || element.kind === "freehand" || element.kind === "polygon") {
      const rotatedPoints = element.points.map((point) => rotatePoint(point, center, angleDeg));
      const rotatedOrigin = rotatePoint({ x: element.x, y: element.y }, center, angleDeg);
      return { ...element, x: rotatedOrigin.x, y: rotatedOrigin.y, points: rotatedPoints };
    }
    if (element.kind === "rectangle" || element.kind === "ellipse") {
      const elementCenter = getBoundsCenter(getElementBounds(element));
      const rotatedCenter = rotatePoint(elementCenter, center, angleDeg);
      return { ...element, x: rotatedCenter.x - element.width / 2, y: rotatedCenter.y - element.height / 2, rotation: (element.rotation ?? 0) + angleDeg };
    }
    const rotatedPosition = rotatePoint({ x: element.x, y: element.y }, center, angleDeg);
    return { ...element, x: rotatedPosition.x, y: rotatedPosition.y, rotation: (element.rotation ?? 0) + angleDeg };
  }

  function handleBoardContextMenu(event: ReactMouseEvent<SVGSVGElement>) {
    event.preventDefault();
    if (!dragState) {
      if (tool !== "select") setTool("select");
      return;
    }
    if (dragState.mode === "pan") {
      setDragState(null);
      return;
    }
    if (dragState.mode === "rotate") return;
    if (dragState.mode === "polygon" || dragState.mode === "measure") {
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
    discardHistoryCapture(dragState.mode === "move");
    setDragState(null);
    if (dragState.mode !== "move" && tool !== "select") setTool("select");
  }

  function handleBoardWheel(event: ReactWheelEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    event.preventDefault();
    const svgElement = svgRef.current;
    zoomBy(event.deltaY > 0 ? 1.12 : 0.88, (current) => clampPoint(getPointerPoint(event as unknown as ReactPointerEvent<SVGSVGElement>, svgElement, current), activeSlide?.background));
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!svgRef.current || !activeSlide) return;
    const point = clampPoint(getPointerPoint(event, svgRef.current, viewport), activeSlide.background);
    if (event.button === 2) {
      event.preventDefault();
      if (tool === "select" && selectedElementIds.length && canEdit) {
        const selectedElements = activeSlide.elements.filter((entry) => selectedElementIds.includes(entry.id));
        if (selectedElements.length) {
          beginHistoryCapture();
          const selectionBounds = selectedElements.reduce<{ x: number; y: number; width: number; height: number } | null>((current, element) => {
            const bounds = getElementBounds(element);
            if (!current) return bounds;
            const left = Math.min(current.x, bounds.x);
            const top = Math.min(current.y, bounds.y);
            const right = Math.max(current.x + current.width, bounds.x + bounds.width);
            const bottom = Math.max(current.y + current.height, bounds.y + bounds.height);
            return { x: left, y: top, width: right - left, height: bottom - top };
          }, null);
          if (selectionBounds) {
            const center = getBoundsCenter(selectionBounds);
            setDragState({ mode: "rotate", elementIds: selectedElementIds, center, startAngle: getAngleFromPoint(point, center), snapshots: selectedElements.map((entry) => ({ id: entry.id, element: structuredClone(entry) })) });
          }
        }
      }
      return;
    }

    svgRef.current.setPointerCapture(event.pointerId);
    if (event.button === 1 || (event.button === 0 && tool === "select" && (viewport.width < canvas.width || viewport.height < canvas.height))) {
      event.preventDefault();
      if (event.button === 0 && tool === "select") updateSelection([]);
      setDragState({ mode: "pan", origin: { x: event.clientX, y: event.clientY }, viewport });
      return;
    }
    if (!canEdit) return;
    if (tool === "icon") {
      const catalogItem = getHllStratmapCatalog().find((item) => item.id === iconId);
      if (!catalogItem) return;
      applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, { id: crypto.randomUUID(), kind: "icon", x: point.x, y: point.y, size: 30, iconId: catalogItem.id, color: strokeColor, note: "", attachments: [] }] })));
      return;
    }
    if (tool === "text") {
      applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, { id: crypto.randomUUID(), kind: "text", x: point.x, y: point.y, text: textValue.trim() || "Text", fontSize: textSize, width: 360, color: strokeColor }] })));
      return;
    }
    if (tool === "ping") {
      const nextState = updateSlide(stateRef.current, selectedSlideId, (slide) => ({ ...slide, pings: [...slide.pings, { id: crypto.randomUUID(), x: point.x, y: point.y, color: strokeColor, createdAt: new Date().toISOString() }] }));
      setState(nextState);
      void requestSave();
      return;
    }
    if (tool === "freehand") {
      beginHistoryCapture();
      setDragState({ mode: "freehand", points: [point] });
      return;
    }
    if (tool === "line") {
      beginHistoryCapture();
      setDragState({ mode: "line", start: point, current: point });
      return;
    }
    if (tool === "polygon") {
      if (dragState?.mode !== "polygon") {
        beginHistoryCapture();
        setDragState({ mode: "polygon", points: [point], current: point });
        return;
      }
      if (dragState.points.length >= 3 && getPointDistance(point, dragState.points[0]!) <= 56) {
        finalizePolygon(dragState.points);
        return;
      }
      setDragState({ ...dragState, points: [...dragState.points, point], current: point });
      return;
    }
    if (tool === "measure") {
      if (dragState?.mode !== "measure") {
        beginHistoryCapture();
        setDragState({ mode: "measure", points: [point], current: point });
        return;
      }
      const nextPoints = [...dragState.points, point];
      if (event.detail >= 2) {
        finalizeMeasure(nextPoints);
        return;
      }
      setDragState({ ...dragState, points: nextPoints, current: point });
      return;
    }
    if (tool === "rectangle") {
      beginHistoryCapture();
      setDragState({ mode: "rectangle", start: point, current: point });
      return;
    }
    if (tool === "ellipse") {
      beginHistoryCapture();
      setDragState({ mode: "ellipse", start: point, current: point });
      return;
    }
    if (tool === "select") {
      updateSelection([]);
      setDragState({ mode: "selectArea", start: point, current: point });
      return;
    }
    if (tool === "delete") setDragState({ mode: "deleteArea", start: point, current: point });
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!svgRef.current || !dragState) return;
    const point = clampPoint(getPointerPoint(event, svgRef.current, viewport), activeSlide?.background);
    if (dragState.mode === "pan") {
      const { width } = getSvgViewportMetrics(svgRef.current, dragState.viewport);
      const scale = dragState.viewport.width / width;
      setViewport(clampViewport({ ...dragState.viewport, x: dragState.viewport.x - (event.clientX - dragState.origin.x) * scale, y: dragState.viewport.y - (event.clientY - dragState.origin.y) * scale }, activeSlide?.background));
      return;
    }
    if (!canEdit) return;
    if (dragState.mode === "move") {
      const deltaX = point.x - dragState.origin.x;
      const deltaY = point.y - dragState.origin.y;
      setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.map((element) => {
        const snapshot = dragState.snapshots.find((entry) => entry.id === element.id);
        return snapshot ? translateElement(snapshot.element, deltaX, deltaY) : element;
      }) })));
      return;
    }
    if (dragState.mode === "rotate") {
      const angle = getAngleFromPoint(point, dragState.center) - dragState.startAngle;
      setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.map((element) => {
        const snapshot = dragState.snapshots.find((entry) => entry.id === element.id);
        return snapshot ? rotateElement(snapshot.element, dragState.center, angle) : element;
      }) })));
      return;
    }
    if (dragState.mode === "freehand") {
      setDragState({ ...dragState, points: [...dragState.points, point] });
      return;
    }
    if (dragState.mode === "polygon" || dragState.mode === "measure") {
      setDragState({ ...dragState, current: point });
      return;
    }
    setDragState({ ...dragState, current: point });
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    svgRef.current?.releasePointerCapture(event.pointerId);
    if (!dragState) return;
    if (dragState.mode === "pan" || dragState.mode === "rotate") {
      endHistoryCapture();
      setDragState(null);
      return;
    }
    if (!canEdit) return;
    if (dragState.mode === "polygon" || dragState.mode === "measure") return;
    if (dragState.mode === "freehand") {
      const nextElement: StratmapFreehandElement = { id: crypto.randomUUID(), kind: "freehand", x: dragState.points[0]?.x ?? 0, y: dragState.points[0]?.y ?? 0, points: dragState.points, strokeColor, strokeWidth, strokeStyle: lineStyle };
      setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] })));
    }
    if (dragState.mode === "line") {
      const nextElement: StratmapLineElement = { id: crypto.randomUUID(), kind: "line", x: dragState.start.x, y: dragState.start.y, points: [dragState.start, dragState.current], strokeColor, strokeWidth, strokeStyle: lineStyle, startStyle: lineStartStyle, endStyle: lineEndStyle, showDistance: showLineDistance };
      setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] })));
    }
    if (dragState.mode === "rectangle" || dragState.mode === "ellipse") {
      const bounds = buildShapeBounds(dragState.start, dragState.current);
      const nextElement: StratmapShapeElement = { id: crypto.randomUUID(), kind: dragState.mode, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, strokeColor, strokeWidth, fillColor, fillOpacity: 0.2, strokeStyle: lineStyle };
      setState((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: [...slide.elements, nextElement] })));
    }
    if (dragState.mode === "selectArea") {
      if (isAreaDrag(dragState)) updateSelection(getElementsInBounds(activeSlide.elements, buildShapeBounds(dragState.start, dragState.current)));
      setDragState(null);
      return;
    }
    if (dragState.mode === "deleteArea") {
      if (isAreaDrag(dragState)) {
        const ids = new Set(getElementsInBounds(activeSlide.elements, buildShapeBounds(dragState.start, dragState.current)));
        if (ids.size) {
          applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.filter((element) => !ids.has(element.id)) })));
          setSelectedElementIds((current) => current.filter((id) => !ids.has(id)));
        }
      }
      setDragState(null);
      return;
    }
    endHistoryCapture();
    setDragState(null);
  }

  function startMove(elementId: string, event: ReactPointerEvent<SVGGElement>) {
    if (!svgRef.current || !activeSlide) return;
    const point = clampPoint(getPointerPoint(event as unknown as ReactPointerEvent<SVGSVGElement>, svgRef.current, viewport), activeSlide.background);
    const element = activeSlide.elements.find((entry) => entry.id === elementId);
    if (!element) return;
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      updateSelection(selectedElementIds.includes(elementId) ? selectedElementIds : [...selectedElementIds, elementId]);
      return;
    }
    const nextSelection = selectedElementIds.includes(elementId) ? selectedElementIds : [elementId];
    updateSelection(nextSelection);
    if (!canEdit) return;
    if (tool === "icon" || tool === "delete") {
      applyStateChange((current) => updateSlide(current, selectedSlideId, (slide) => ({ ...slide, elements: slide.elements.filter((entry) => entry.id !== elementId) })));
      setSelectedElementIds((current) => current.filter((id) => id !== elementId));
      return;
    }
    if (tool !== "select") return;
    if (event.button === 2) {
      beginHistoryCapture();
      const selectedElements = activeSlide.elements.filter((entry) => nextSelection.includes(entry.id));
      const selectionBounds = selectedElements.reduce<{ x: number; y: number; width: number; height: number } | null>((current, entry) => {
        const bounds = getElementBounds(entry);
        if (!current) return bounds;
        const left = Math.min(current.x, bounds.x);
        const top = Math.min(current.y, bounds.y);
        const right = Math.max(current.x + current.width, bounds.x + bounds.width);
        const bottom = Math.max(current.y + current.height, bounds.y + bounds.height);
        return { x: left, y: top, width: right - left, height: bottom - top };
      }, null);
      if (selectionBounds) {
        const center = getBoundsCenter(selectionBounds);
        setDragState({ mode: "rotate", elementIds: nextSelection, center, startAngle: getAngleFromPoint(point, center), snapshots: selectedElements.map((entry) => ({ id: entry.id, element: structuredClone(entry) })) });
      }
      return;
    }
    beginHistoryCapture();
    setDragState({ mode: "move", elementIds: nextSelection, origin: point, snapshots: activeSlide.elements.filter((entry) => nextSelection.includes(entry.id)).map((entry) => ({ id: entry.id, element: structuredClone(entry) })) });
  }

  async function handleSlideBackgroundUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingSlideBackground(true);
    try {
      const result = await uploadFileToConvex(file, {
        prepareUploadError: "Unable to prepare the image upload.",
        uploadFileError: "Unable to upload the image.",
        readFileUrlError: "Unable to read the uploaded image URL.",
      });
      const dimensions = await readImageDimensions(result.url);
      setPendingSlideBackground({ kind: "image", imageUrl: result.url, imageWidth: dimensions.width, imageHeight: dimensions.height, imageFilename: file.name });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : dictionary.stratmaps.uploadImagesError);
    } finally {
      setIsUploadingSlideBackground(false);
      event.target.value = "";
    }
  }

  async function handleSelectedIconAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length || !selectedElementId) return;
    setIsUploadingIconAttachments(true);
    try {
      const uploaded: StratmapElementAttachment[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadFileToConvex(file, {
          prepareUploadError: "Unable to prepare the image upload.",
          uploadFileError: "Unable to upload the image.",
          readFileUrlError: "Unable to read the uploaded image URL.",
        });
        uploaded.push({ url: result.url, filename: file.name, contentType: file.type || undefined, description: "" });
      }
      setElementUpdater(selectedElementId, (element) => element.kind === "icon" ? { ...element, attachments: [...(element.attachments ?? []), ...uploaded] } : element);
      toast.success(dictionary.stratmaps.imagesAttached);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : dictionary.stratmaps.uploadImagesError);
    } finally {
      setIsUploadingIconAttachments(false);
      event.target.value = "";
    }
  }

  return {
    rootRef, svgRef, canAdmin, canEdit, mode, setMode, isPending, tool, strokeColor, fillColor, strokeWidth, lineStyle, lineStartStyle, lineEndStyle, showLineDistance, iconId, textValue, textSize, selectedElementIds, hoveredElementId, selectedSlideId, dragState, viewport, title, description, baseMapId, side, strongpointId, state, isUploadingIconAttachments, activeSlide, maps, selectedMap, catalogGroups, overlayStrongpointIds, selectedElement, canUndo: historyState.canUndo, canRedo: historyState.canRedo, isCreateSlideModalOpen, newSlideName, pendingSlideBackground, isUploadingSlideBackground,
    setTool, setStrokeColor, setFillColor, setStrokeWidth, setLineStyle, setLineStartStyle, setLineEndStyle, setShowLineDistance, setIconId, setTextValue, setTextSize, setTitle, setDescription, setSide, setStrongpointId, setSelectedSlideId, setHoveredElementId, setNewSlideName,
    saveMeta, addSlide, closeCreateSlideModal, confirmCreateSlide, duplicateSlide, renameSlide, moveSlide, deleteSlide, handleOverlayChange, toggleStrongpoint, undo, redo, zoomIn: () => zoomBy(0.85), zoomOut: () => zoomBy(1.15), resetZoom: () => setViewport(createViewport(activeSlide?.background)), handleBoardWheel, handleBoardContextMenu, handlePointerDown, handlePointerMove, handlePointerUp, startMove, removeSelectedElements, handleSelectedElementChange, handleSelectedIconAttachmentUpload, handleSlideBackgroundUpload, handleBaseMapChange,
  };
}

async function readImageDimensions(src: string) {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Unable to read image dimensions."));
    image.src = src;
  });
}
