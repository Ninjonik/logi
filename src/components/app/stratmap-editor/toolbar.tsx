"use client";

import { Circle as CircleIcon, Crosshair, Eraser, Minus, MousePointer2, PenLine, Pentagon, Plus, Redo2, Ruler, Shapes, Square, Type, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <IconButton icon={Undo2} label={dictionary.stratmaps.undo} onClick={onUndo} disabled={!canUndo} />
        <IconButton icon={Redo2} label={dictionary.stratmaps.redo} onClick={onRedo} disabled={!canRedo} />
        <IconButton icon={Plus} label={dictionary.stratmaps.zoomIn ?? "Zoom in"} onClick={onZoomIn} />
        <IconButton icon={Minus} label={dictionary.stratmaps.zoomOut ?? "Zoom out"} onClick={onZoomOut} />
        <TextIconButton label="100%" tooltip={dictionary.stratmaps.resetZoom ?? "Reset zoom"} onClick={onResetZoom} />
      </div>
      <div className="flex flex-wrap gap-2">
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
    </div>
  );
}

function ToolButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof MousePointer2; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={active ? "default" : "outline"} size="icon" className="size-8 rounded-md" onClick={onClick}>
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled = false }: { icon: typeof MousePointer2; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-md" onClick={onClick} disabled={disabled}>
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function TextIconButton({ label, tooltip, onClick }: { label: string; tooltip: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="size-8 rounded-md text-[10px] font-semibold" onClick={onClick}>
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
