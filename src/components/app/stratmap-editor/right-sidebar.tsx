"use client";

import type { ChangeEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapCatalogItem, StratmapArrowStyle, StratmapElement } from "@/lib/stratmaps";

import { AttachmentGallery } from "./selection-inspector";
import { StratmapToolbar } from "./toolbar";
import { ToolPropertiesPanel } from "./tool-properties-panel";
import type { Tool } from "./types";
import { SelectionInspector } from "./selection-inspector";

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
  const selectedIconAttachments =
    selectedElement?.kind === "icon" ? selectedElement.attachments?.filter((attachment) => attachment.url) ?? [] : [];

  return (
    <div className="min-w-0 space-y-2 overflow-x-hidden overflow-y-auto pl-1">
      <StratmapToolbar {...{ dictionary, tool, canUndo, canRedo, onUndo, onRedo, onZoomIn, onZoomOut, onResetZoom, onToolChange }} />
      {selectedIconAttachments.length ? (
        <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
          <CardHeader className="px-3 py-3">
            <CardTitle className="text-base">{dictionary.stratmaps.images}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <AttachmentGallery
              dictionary={dictionary}
              attachments={selectedIconAttachments}
              canAdmin={canAdmin}
              isUploading={isUploadingIconAttachments}
              onUpload={onUpload}
              onDescriptionChange={(index, value) =>
                onSelectedElementChange((element) =>
                  element.kind === "icon"
                    ? {
                        ...element,
                        attachments: (element.attachments ?? []).map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, description: value } : entry,
                        ),
                      }
                    : element,
                )
              }
              onRemove={(index) =>
                onSelectedElementChange((element) =>
                  element.kind === "icon"
                    ? { ...element, attachments: (element.attachments ?? []).filter((_, attachmentIndex) => attachmentIndex !== index) }
                    : element,
                )
              }
            />
          </CardContent>
        </Card>
      ) : null}
      <ToolPropertiesPanel {...{ dictionary, tool, strokeColor, fillColor, strokeWidth, lineStyle, lineStartStyle, lineEndStyle, showLineDistance, textValue, textSize, iconId, catalogGroups, onStrokeColorChange, onFillColorChange, onStrokeWidthChange, onLineStyleChange, onLineStartStyleChange, onLineEndStyleChange, onShowLineDistanceChange, onTextValueChange, onTextSizeChange, onIconChange }} />
      <SelectionInspector {...{ dictionary, canAdmin, strokeColor, selectedElement, isUploadingIconAttachments, onElementChange: onSelectedElementChange, onUpload }} />
    </div>
  );
}
