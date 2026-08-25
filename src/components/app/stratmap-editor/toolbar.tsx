"use client";

import { Circle as CircleIcon, Crosshair, Eraser, Minus, MousePointer2, PenLine, Pentagon, Plus, Redo2, Ruler, Shapes, Square, Type, Undo2 } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";

import { EditorButton, EditorIconButton, EditorPanel } from "./editor-controls";
import type { Tool } from "./types";

export function StratmapToolbar({
  dictionary,
  tool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToolChange,
}: {
  dictionary: Dictionary;
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToolChange: (tool: Tool) => void;
}) {
  return (
    <EditorPanel title="Tools">
      <div className="grid grid-cols-5 gap-0.5">
        <IconButton icon={Undo2} label={dictionary.stratmaps.undo} onClick={onUndo} disabled={!canUndo} />
        <IconButton icon={Redo2} label={dictionary.stratmaps.redo} onClick={onRedo} disabled={!canRedo} />
        <IconButton icon={Plus} label={dictionary.stratmaps.zoomIn ?? "Zoom in"} onClick={onZoomIn} />
        <IconButton icon={Minus} label={dictionary.stratmaps.zoomOut ?? "Zoom out"} onClick={onZoomOut} />
        <TextIconButton label="100%" tooltip={dictionary.stratmaps.resetZoom ?? "Reset zoom"} onClick={onResetZoom} />
      </div>
      <div className="grid grid-cols-6 gap-0.5 border-t border-border/50 pt-1.5">
        <ToolButton active={tool === "select"} onClick={() => onToolChange("select")} icon={MousePointer2} label={dictionary.stratmaps.selectTool} />
        <ToolButton active={tool === "freehand"} onClick={() => onToolChange("freehand")} icon={PenLine} label={dictionary.stratmaps.drawTool} />
        <ToolButton active={tool === "line"} onClick={() => onToolChange("line")} icon={Minus} label={dictionary.stratmaps.lineTool} />
        <ToolButton active={tool === "polygon"} onClick={() => onToolChange("polygon")} icon={Pentagon} label={dictionary.stratmaps.polygonTool} />
        <ToolButton active={tool === "measure"} onClick={() => onToolChange("measure")} icon={Ruler} label={dictionary.stratmaps.measureTool} />
        <ToolButton active={tool === "rectangle"} onClick={() => onToolChange("rectangle")} icon={Square} label={dictionary.stratmaps.rectTool} />
        <ToolButton active={tool === "ellipse"} onClick={() => onToolChange("ellipse")} icon={CircleIcon} label={dictionary.stratmaps.circleTool} />
        <ToolButton active={tool === "text"} onClick={() => onToolChange("text")} icon={Type} label={dictionary.stratmaps.text} />
        <ToolButton active={tool === "icon"} onClick={() => onToolChange("icon")} icon={Shapes} label={dictionary.stratmaps.iconLabel ?? "Icon"} />
        <ToolButton active={tool === "delete"} onClick={() => onToolChange("delete")} icon={Eraser} label={dictionary.stratmaps.deleteTool} />
        <ToolButton active={tool === "ping"} onClick={() => onToolChange("ping")} icon={Crosshair} label={dictionary.stratmaps.pingTool} />
      </div>
    </EditorPanel>
  );
}

function ToolButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof MousePointer2; label: string }) {
  return (
    <EditorIconButton icon={Icon} label={label} active={active} className="size-7 w-full" onClick={onClick} />
  );
}

function IconButton({ icon: Icon, label, onClick, disabled = false }: { icon: typeof MousePointer2; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <EditorIconButton icon={Icon} label={label} className="size-7 w-full" onClick={onClick} disabled={disabled} />
  );
}

function TextIconButton({ label, tooltip, onClick }: { label: string; tooltip: string; onClick: () => void }) {
  return (
    <EditorButton type="button" className="size-7 w-full px-0 font-mono text-[8px]" title={tooltip} aria-label={tooltip} onClick={onClick}>{label}</EditorButton>
  );
}
