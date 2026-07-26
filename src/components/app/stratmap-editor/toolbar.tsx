"use client";

import { Circle as CircleIcon, Crosshair, Eraser, Minus, MousePointer2, PenLine, Plus, Redo2, Shapes, Square, Type, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";

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
    <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" variant="outline" className="h-8 rounded-lg px-2 text-xs" onClick={onUndo} disabled={!canUndo}><Undo2 className="size-4" />{dictionary.stratmaps.undo}</Button>
      <Button type="button" variant="outline" className="h-8 rounded-lg px-2 text-xs" onClick={onRedo} disabled={!canRedo}><Redo2 className="size-4" />{dictionary.stratmaps.redo}</Button>
      <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" onClick={onZoomIn}><Plus className="size-4" /></Button>
      <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" onClick={onZoomOut}><Minus className="size-4" /></Button>
      <Button type="button" variant="outline" className="h-8 rounded-lg px-2 text-xs" onClick={onResetZoom}>100%</Button>
      <ToolButton active={tool === "select"} onClick={() => onToolChange("select")} icon={MousePointer2} label={dictionary.stratmaps.selectTool} />
      <ToolButton active={tool === "freehand"} onClick={() => onToolChange("freehand")} icon={PenLine} label={dictionary.stratmaps.drawTool} />
      <ToolButton active={tool === "line"} onClick={() => onToolChange("line")} icon={Minus} label={dictionary.stratmaps.lineTool} />
      <ToolButton active={tool === "rectangle"} onClick={() => onToolChange("rectangle")} icon={Square} label={dictionary.stratmaps.rectTool} />
      <ToolButton active={tool === "ellipse"} onClick={() => onToolChange("ellipse")} icon={CircleIcon} label={dictionary.stratmaps.circleTool} />
      <ToolButton active={tool === "text"} onClick={() => onToolChange("text")} icon={Type} label={dictionary.stratmaps.text} />
      <ToolButton active={tool === "icon"} onClick={() => onToolChange("icon")} icon={Shapes} label="Icon" />
      <ToolButton active={tool === "delete"} onClick={() => onToolChange("delete")} icon={Eraser} label={dictionary.stratmaps.deleteTool} />
      <ToolButton active={tool === "ping"} onClick={() => onToolChange("ping")} icon={Crosshair} label={dictionary.stratmaps.pingTool} />
    </div>
  );
}

function ToolButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof MousePointer2; label: string }) {
  return (
    <Button variant={active ? "default" : "outline"} className="h-8 rounded-lg px-2.5 text-xs" onClick={onClick}>
      <Icon className="size-4" />
      {label}
    </Button>
  );
}
