"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { ChevronDown, Eye, ImageIcon, PencilLine, SlidersHorizontal, SquareMousePointer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  canEdit,
  mode,
  onModeChange,
  tool,
  canUndo,
  canRedo,
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
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToolChange,
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
  canEdit: boolean;
  mode: "view" | "edit";
  onModeChange: (mode: "view" | "edit") => void;
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
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
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToolChange: (tool: Tool) => void;
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
  const [imagesOpen, setImagesOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [selectedIconOpen, setSelectedIconOpen] = useState(true);

  return (
    <div className="min-w-0 space-y-2 overflow-x-hidden overflow-y-auto pl-1">
      {canAdmin ? (
        <div className="flex items-center gap-2 pb-1">
          <Button
            type="button"
            variant={mode === "view" ? "default" : "outline"}
            size="icon"
            className="size-8 rounded-lg"
            onClick={() => onModeChange("view")}
            title="View mode"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            type="button"
            variant={mode === "edit" ? "default" : "outline"}
            size="icon"
            className="size-8 rounded-lg"
            onClick={() => onModeChange("edit")}
            title="Edit mode"
          >
            <PencilLine className="size-4" />
          </Button>
        </div>
      ) : null}
      {mode === "edit" ? <StratmapToolbar {...{ dictionary, tool, canUndo, canRedo, onUndo, onRedo, onZoomIn, onZoomOut, onResetZoom, onToolChange }} /> : null}
      {mode === "edit" && tool !== "select" ? (
        <Collapsible open={propertiesOpen} onOpenChange={setPropertiesOpen}>
          <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
            <CardHeader className="px-3 py-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base">{dictionary.stratmaps.toolProperties}</CardTitle>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${propertiesOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="px-3 pb-3">
                <ToolPropertiesPanel {...{ dictionary, tool, strokeWidth, lineStyle, lineStartStyle, lineEndStyle, showLineDistance, textValue, textSize, iconId, catalogGroups, onStrokeWidthChange, onLineStyleChange, onLineStartStyleChange, onLineEndStyleChange, onShowLineDistanceChange, onTextValueChange, onTextSizeChange, onIconChange }} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ) : null}
      {selectedElement ? (
        <Collapsible open={selectedIconOpen} onOpenChange={setSelectedIconOpen}>
          <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
            <CardHeader className="px-3 py-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <SquareMousePointer className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base">{selectedElement.kind === "icon" ? dictionary.stratmaps.selectedIcon : dictionary.stratmaps.selectedElement}</CardTitle>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${selectedIconOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <SelectionInspector {...{ dictionary, canAdmin, canEdit, mode, selectedElement, isUploadingIconAttachments, onElementChange: onSelectedElementChange, onUpload }} />
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ) : null}
      {selectedIconAttachments.length ? (
        <Collapsible open={imagesOpen} onOpenChange={setImagesOpen}>
          <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
            <CardHeader className="px-3 py-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base">{dictionary.stratmaps.images}</CardTitle>
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${imagesOpen ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="px-3 pb-3">
                <AttachmentGallery
                  dictionary={dictionary}
                  attachments={selectedIconAttachments}
                  canAdmin={canAdmin}
                  mode={mode}
                  isUploading={isUploadingIconAttachments}
                  onUpload={onUpload}
                  onDescriptionChange={mode === "edit" ? (index, value) => onSelectedElementChange((element) => element.kind === "icon" ? { ...element, attachments: (element.attachments ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, description: value } : entry) } : element) : () => undefined}
                  onRemove={mode === "edit" ? (index) => onSelectedElementChange((element) => element.kind === "icon" ? { ...element, attachments: (element.attachments ?? []).filter((_, attachmentIndex) => attachmentIndex !== index) } : element) : () => undefined}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ) : null}
    </div>
  );
}
