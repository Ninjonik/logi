"use client";

import type { ChangeEvent } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapCatalogItem, StratmapArrowStyle, StratmapElement } from "@/lib/stratmaps";

import { SelectionInspector } from "./selection-inspector";
import { StratmapToolbar } from "./toolbar";
import { ToolPropertiesPanel } from "./tool-properties-panel";
import type { Tool } from "./types";

export function StratmapRightSidebar({
  dictionary,
  canAdmin,
  tool,
  canUndo,
  canRedo,
  strokeColor,
  fillColor,
  strokeWidth,
  lineStyle,
  lineStartStyle,
  lineEndStyle,
  showLineDistance,
  textValue,
  textSize,
  iconId,
  catalogGroups,
  selectedElement,
  isUploadingIconAttachments,
  onStrokeColorChange,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToolChange,
  onFillColorChange,
  onStrokeWidthChange,
  onLineStyleChange,
  onLineStartStyleChange,
  onLineEndStyleChange,
  onShowLineDistanceChange,
  onTextValueChange,
  onTextSizeChange,
  onIconChange,
  onSelectedElementChange,
  onUpload,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  lineStartStyle: StratmapArrowStyle;
  lineEndStyle: StratmapArrowStyle;
  showLineDistance: boolean;
  textValue: string;
  textSize: number;
  iconId: string;
  catalogGroups: Record<string, HllStratmapCatalogItem[]>;
  selectedElement: StratmapElement | null;
  isUploadingIconAttachments: boolean;
  onStrokeColorChange: (value: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToolChange: (tool: Tool) => void;
  onFillColorChange: (value: string) => void;
  onStrokeWidthChange: (value: number) => void;
  onLineStyleChange: (value: "solid" | "dashed" | "dotted") => void;
  onLineStartStyleChange: (value: StratmapArrowStyle) => void;
  onLineEndStyleChange: (value: StratmapArrowStyle) => void;
  onShowLineDistanceChange: (value: boolean) => void;
  onTextValueChange: (value: string) => void;
  onTextSizeChange: (value: number) => void;
  onIconChange: (value: string) => void;
  onSelectedElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2 overflow-y-auto pl-1">
      <StratmapToolbar {...{ dictionary, tool, canUndo, canRedo, onUndo, onRedo, onZoomIn, onZoomOut, onResetZoom, onToolChange }} />
      <ToolPropertiesPanel {...{ dictionary, tool, strokeColor, fillColor, strokeWidth, lineStyle, lineStartStyle, lineEndStyle, showLineDistance, textValue, textSize, iconId, catalogGroups, onStrokeColorChange, onFillColorChange, onStrokeWidthChange, onLineStyleChange, onLineStartStyleChange, onLineEndStyleChange, onShowLineDistanceChange, onTextValueChange, onTextSizeChange, onIconChange }} />
      <SelectionInspector {...{ dictionary, canAdmin, strokeColor, selectedElement, isUploadingIconAttachments, onElementChange: onSelectedElementChange, onUpload }} />
    </div>
  );
}
