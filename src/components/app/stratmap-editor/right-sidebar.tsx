"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { ChevronDown, Eye, ImageIcon, PencilLine, SlidersHorizontal, SquareMousePointer } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapCatalogItem, StratmapArrowStyle, StratmapElement } from "@/lib/stratmaps";

import { EditorIconButton, EditorPanel } from "./editor-controls";
import { AttachmentGallery, SelectionInspector } from "./selection-inspector";
import { StratmapToolbar } from "./toolbar";
import { ToolPropertiesPanel } from "./tool-properties-panel";
import type { Tool } from "./types";

type RightSidebarProps = {
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
};

export function StratmapRightSidebar(props: RightSidebarProps) {
  const { dictionary, canAdmin, canEdit, mode, onModeChange, tool, selectedElement, isUploadingIconAttachments, onSelectedElementChange, onUpload } = props;
  const [imagesOpen, setImagesOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [selectionOpen, setSelectionOpen] = useState(true);
  const selectedIcon = selectedElement?.kind === "icon" ? selectedElement : null;
  const attachments = selectedIcon?.attachments?.filter((attachment) => attachment.url) ?? [];

  return (
    <aside className="min-w-0 space-y-1 overflow-x-hidden overflow-y-auto pl-0.5 [scrollbar-width:thin]">
      {canAdmin ? (
        <div className="flex h-7 items-center gap-0.5 rounded-[4px] border border-border/70 bg-card/55 p-0.5">
          <EditorIconButton icon={Eye} label="View mode" active={mode === "view"} className="h-6 flex-1" onClick={() => onModeChange("view")} />
          <EditorIconButton icon={PencilLine} label="Edit mode" active={mode === "edit"} className="h-6 flex-1" onClick={() => onModeChange("edit")} />
        </div>
      ) : null}

      {mode === "edit" ? <StratmapToolbar {...props} /> : null}

      {mode === "edit" && tool !== "select" ? (
        <EditorPanel title={dictionary.stratmaps.toolProperties} icon={SlidersHorizontal} action={<CollapseButton open={propertiesOpen} onClick={() => setPropertiesOpen((value) => !value)} />}>
          {propertiesOpen ? <ToolPropertiesPanel {...props} /> : null}
        </EditorPanel>
      ) : null}

      {selectedElement && !(mode === "view" && selectedElement.kind === "icon") ? (
        <EditorPanel title={selectedElement.kind === "icon" ? dictionary.stratmaps.selectedIcon : dictionary.stratmaps.selectedElement} icon={SquareMousePointer} action={<CollapseButton open={selectionOpen} onClick={() => setSelectionOpen((value) => !value)} />}>
          {selectionOpen ? <SelectionInspector dictionary={dictionary} canAdmin={canAdmin} canEdit={canEdit} mode={mode} selectedElement={selectedElement} onElementChange={onSelectedElementChange} /> : null}
        </EditorPanel>
      ) : null}

      {selectedIcon ? (
        <EditorPanel title={dictionary.stratmaps.images} icon={ImageIcon} action={<CollapseButton open={imagesOpen} onClick={() => setImagesOpen((value) => !value)} />}>
          {imagesOpen ? (
            <AttachmentGallery
              dictionary={dictionary}
              attachments={attachments}
              mainAttachmentUrl={selectedIcon.mainAttachmentUrl}
              fallbackNote={selectedIcon.note}
              canAdmin={canAdmin}
              mode={mode}
              isUploading={isUploadingIconAttachments}
              onUpload={onUpload}
              onMainAttachmentChange={(url) => onSelectedElementChange((element) => element.kind === "icon" ? { ...element, mainAttachmentUrl: url } : element)}
              onDescriptionChange={mode === "edit" ? (index, value) => onSelectedElementChange((element) => element.kind === "icon" ? { ...element, attachments: (element.attachments ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, description: value } : entry) } : element) : () => undefined}
              onRemove={mode === "edit" ? (index) => onSelectedElementChange((element) => {
                if (element.kind !== "icon") return element;
                const removedUrl = element.attachments?.[index]?.url;
                const attachmentsAfterRemoval = (element.attachments ?? []).filter((_, attachmentIndex) => attachmentIndex !== index);
                return {
                  ...element,
                  attachments: attachmentsAfterRemoval,
                  mainAttachmentUrl: element.mainAttachmentUrl === removedUrl ? attachmentsAfterRemoval[0]?.url : element.mainAttachmentUrl,
                };
              }) : () => undefined}
            />
          ) : null}
        </EditorPanel>
      ) : null}
    </aside>
  );
}

function CollapseButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <EditorIconButton icon={ChevronDown} label={open ? "Collapse section" : "Expand section"} className={`size-5 border-0 bg-transparent transition-transform ${open ? "rotate-180" : ""}`} onClick={onClick} />;
}
