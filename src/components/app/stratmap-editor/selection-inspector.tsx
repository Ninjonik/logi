"use client";

import { useState, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { PhotoProvider, PhotoView } from "react-photo-view";

import type { Dictionary } from "@/i18n/dictionaries";
import type { StratmapArrowStyle, StratmapElement, StratmapElementAttachment } from "@/lib/stratmaps";
import { cn } from "@/lib/utils";

import { EditorButton, EditorField, EditorIconButton, EditorInput, EditorSelect, EditorTextarea, EditorToggle } from "./editor-controls";

const QUICK_COLORS = ["#39ff14", "#2b6ef3", "#ef4444", "#f59e0b", "#ffffff"];

export function SelectionInspector({
  dictionary,
  canAdmin,
  canEdit,
  mode,
  selectedElement,
  isUploadingIconAttachments,
  onElementChange,
  onUpload,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  canEdit: boolean;
  mode: "view" | "edit";
  selectedElement: StratmapElement | null;
  isUploadingIconAttachments: boolean;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!selectedElement) return null;
  if (selectedElement.kind === "icon") return <IconInspector dictionary={dictionary} canAdmin={canAdmin} canEdit={canEdit} mode={mode} selectedElement={selectedElement} isUploadingIconAttachments={isUploadingIconAttachments} onElementChange={onElementChange} onUpload={onUpload} />;
  if (selectedElement.kind === "text") return <TextInspector dictionary={dictionary} canAdmin={canAdmin} selectedElement={selectedElement} onElementChange={onElementChange} />;
  if (selectedElement.kind === "line") return <LineInspector dictionary={dictionary} canAdmin={canAdmin} selectedElement={selectedElement} onElementChange={onElementChange} />;
  if (selectedElement.kind === "rectangle" || selectedElement.kind === "ellipse" || selectedElement.kind === "polygon" || selectedElement.kind === "freehand") {
    return <ShapeInspector dictionary={dictionary} canAdmin={canAdmin} selectedElement={selectedElement} onElementChange={onElementChange} />;
  }
  return null;
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {QUICK_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn("size-5 rounded-[2px] border border-border/70", value === color && "ring-1 ring-primary ring-offset-1 ring-offset-background")}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5 overflow-x-hidden" data-editor-section={title}>{children}</div>
  );
}

function IconInspector({
  dictionary,
  canAdmin,
  canEdit,
  mode,
  selectedElement,
  isUploadingIconAttachments,
  onElementChange,
  onUpload,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  canEdit: boolean;
  mode: "view" | "edit";
  selectedElement: Extract<StratmapElement, { kind: "icon" }>;
  isUploadingIconAttachments: boolean;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (mode === "view") return null;

  return (
    <SectionCard title={dictionary.stratmaps.selectedIcon}>
      <EditorField label="Color">
        <ColorSwatches value={selectedElement.color ?? "#39ff14"} onChange={(value) => onElementChange((element) => element.kind === "icon" ? { ...element, color: value } : element)} />
      </EditorField>
      <EditorField label={dictionary.stratmaps.size}>
        <EditorInput type="number" min={16} max={160} value={selectedElement.size} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, size: Number(event.target.value) || 30 } : element)} disabled={!canAdmin && !canEdit} />
      </EditorField>
      <EditorField label={dictionary.stratmaps.notes}>
        <EditorTextarea value={selectedElement.note ?? ""} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, note: event.target.value } : element)} disabled={!canAdmin} placeholder={dictionary.stratmaps.notePlaceholder} />
      </EditorField>
      <AttachmentGallery
        dictionary={dictionary}
        attachments={selectedElement.attachments ?? []}
        canAdmin={canAdmin}
        mode="edit"
        isUploading={isUploadingIconAttachments}
        onUpload={onUpload}
        onDescriptionChange={(index, value) =>
          onElementChange((element) =>
            element.kind === "icon"
              ? {
                  ...element,
                  attachments: (element.attachments ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, description: value } : entry),
                }
              : element,
          )}
        onRemove={(index) =>
          onElementChange((element) =>
            element.kind === "icon"
              ? {
                  ...element,
                  attachments: (element.attachments ?? []).filter((_, attachmentIndex) => attachmentIndex !== index),
                }
              : element,
          )}
      />
    </SectionCard>
  );
}

function ShapeInspector({
  dictionary,
  canAdmin,
  selectedElement,
  onElementChange,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  selectedElement: Extract<StratmapElement, { kind: "rectangle" | "ellipse" | "polygon" | "freehand" }>;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
}) {
  const stroke = selectedElement.strokeColor ?? "#39ff14";
  const fill = selectedElement.fillColor ?? "rgba(57,255,20,0.2)";

  return (
    <SectionCard title={dictionary.stratmaps.selectedElement}>
      <EditorField label="Color">
        <ColorSwatches value={stroke} onChange={(value) => onElementChange((element) => element.id === selectedElement.id ? { ...element, strokeColor: value, fillColor: element.fillColor?.startsWith("rgba") ? `${value}33` : element.fillColor } : element)} />
      </EditorField>
      <div className="grid grid-cols-2 gap-1">
        <EditorField label={dictionary.stratmaps.strokeWidth}>
          <EditorInput type="number" min={1} max={24} value={selectedElement.strokeWidth ?? 6} onChange={(event) => onElementChange((element) => element.id === selectedElement.id ? { ...element, strokeWidth: Number(event.target.value) || 1 } : element)} disabled={!canAdmin} />
        </EditorField>
        <EditorField label={dictionary.stratmaps.fill}>
          <EditorInput type="color" value={fill.slice(0, 7)} onChange={(event) => onElementChange((element) => element.id === selectedElement.id ? { ...element, fillColor: `${event.target.value}33` } : element)} disabled={!canAdmin} className="p-0.5" />
        </EditorField>
      </div>
    </SectionCard>
  );
}

function TextInspector({
  dictionary,
  canAdmin,
  selectedElement,
  onElementChange,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  selectedElement: Extract<StratmapElement, { kind: "text" }>;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
}) {
  return (
    <SectionCard title={dictionary.stratmaps.selectedElement}>
      <EditorField label="Color">
        <ColorSwatches value={selectedElement.color ?? "#39ff14"} onChange={(value) => onElementChange((element) => element.kind === "text" ? { ...element, color: value } : element)} />
      </EditorField>
      <EditorField label="Background">
        <EditorInput
          type="color"
          value={selectedElement.backgroundColor && selectedElement.backgroundColor !== "transparent" ? selectedElement.backgroundColor.slice(0, 7) : "#000000"}
          onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, backgroundColor: `${event.target.value}cc` } : element)}
          disabled={!canAdmin}
          className="p-0.5"
        />
        <EditorButton type="button" className="mt-1 h-6" onClick={() => onElementChange((element) => element.kind === "text" ? { ...element, backgroundColor: "transparent" } : element)} disabled={!canAdmin}>
          Transparent
        </EditorButton>
      </EditorField>
      <EditorField label={dictionary.stratmaps.text}>
        <EditorTextarea value={selectedElement.text} onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, text: event.target.value } : element)} disabled={!canAdmin} />
      </EditorField>
      <div className="grid grid-cols-2 gap-1">
        <EditorField label={dictionary.stratmaps.fontSize}>
          <EditorInput type="number" min={16} max={96} value={selectedElement.fontSize} onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, fontSize: Number(event.target.value) || 16 } : element)} disabled={!canAdmin} />
        </EditorField>
        <EditorField label="Alignment">
          <EditorSelect value={selectedElement.align ?? "left"} onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, align: event.target.value as "left" | "center" | "right" } : element)} disabled={!canAdmin}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </EditorSelect>
        </EditorField>
      </div>
    </SectionCard>
  );
}

function LineInspector({
  dictionary,
  canAdmin,
  selectedElement,
  onElementChange,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  selectedElement: Extract<StratmapElement, { kind: "line" }>;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
}) {
  return (
    <SectionCard title={dictionary.stratmaps.selectedElement}>
      <EditorField label={dictionary.stratmaps.color}>
        <ColorSwatches value={selectedElement.strokeColor ?? "#39ff14"} onChange={(value) => onElementChange((element) => element.kind === "line" ? { ...element, strokeColor: value } : element)} />
      </EditorField>
      <EditorField label={dictionary.stratmaps.strokeWidth}>
        <EditorInput type="number" min={1} max={24} value={selectedElement.strokeWidth ?? 6} onChange={(event) => onElementChange((element) => element.kind === "line" ? { ...element, strokeWidth: Number(event.target.value) || 1 } : element)} disabled={!canAdmin} />
      </EditorField>
      <div className="grid grid-cols-2 gap-1">
        <EditorField label={dictionary.stratmaps.lineStart}>
          <ArrowStyleSelect value={selectedElement.startStyle ?? "none"} onChange={(value) => onElementChange((element) => element.kind === "line" ? { ...element, startStyle: value } : element)} dictionary={dictionary} disabled={!canAdmin} />
        </EditorField>
        <EditorField label={dictionary.stratmaps.lineEnd}>
          <ArrowStyleSelect value={selectedElement.endStyle ?? "arrow"} onChange={(value) => onElementChange((element) => element.kind === "line" ? { ...element, endStyle: value } : element)} dictionary={dictionary} disabled={!canAdmin} />
        </EditorField>
      </div>
      <EditorToggle label={dictionary.stratmaps.showDistance} checked={selectedElement.showDistance ?? false} onCheckedChange={(checked) => onElementChange((element) => element.kind === "line" ? { ...element, showDistance: checked } : element)} disabled={!canAdmin} />
    </SectionCard>
  );
}

export function AttachmentGallery({
  dictionary,
  attachments,
  canAdmin,
  mode,
  isUploading,
  onUpload,
  onDescriptionChange,
  onRemove,
}: {
  dictionary: Dictionary;
  attachments: StratmapElementAttachment[];
  canAdmin: boolean;
  mode: "view" | "edit";
  isUploading: boolean;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const activeAttachment = attachments[lightboxIndex];

  return (
    <div className="space-y-1.5">
      {canAdmin && mode === "edit" ? (
        <label className="inline-flex h-6 cursor-pointer items-center justify-center gap-1 rounded-[3px] border border-border/70 bg-background/70 px-2 text-[10px] font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
          <ImagePlus className="size-3" />
          {isUploading ? dictionary.stratmaps.uploading : dictionary.stratmaps.attachImages}
          <input type="file" multiple accept="image/*" className="sr-only" onChange={onUpload} />
        </label>
      ) : null}
      {!attachments.length ? <div className="text-[10px] text-muted-foreground">{dictionary.stratmaps.noImages}</div> : null}
      {attachments.length ? (
        <PhotoProvider loop maskOpacity={0.92} onIndexChange={(index) => setLightboxIndex(index)} overlayRender={() => activeAttachment?.description ? <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex justify-center"><div className="max-w-3xl rounded-xl border border-white/15 bg-black/70 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">{activeAttachment.description}</div></div> : null}>
          <div className={mode === "view" ? "grid grid-cols-2 gap-1" : "space-y-1.5"}>
            {attachments.map((attachment, index) => (
              <AttachmentCard key={`${attachment.url}-${index}`} attachment={attachment} index={index} dictionary={dictionary} canAdmin={canAdmin} mode={mode} onDescriptionChange={(value) => onDescriptionChange(index, value)} onRemove={() => onRemove(index)} />
            ))}
          </div>
        </PhotoProvider>
      ) : null}
    </div>
  );
}

function AttachmentCard({
  attachment,
  index,
  dictionary,
  canAdmin,
  mode,
  onDescriptionChange,
  onRemove,
}: {
  attachment: StratmapElementAttachment;
  index: number;
  dictionary: Dictionary;
  canAdmin: boolean;
  mode: "view" | "edit";
  onDescriptionChange: (value: string) => void;
  onRemove: () => void;
}) {
  const previewable = isPreviewableImage(attachment);

  return (
    <div className={`min-w-0 overflow-hidden rounded-[3px] border border-border/60 ${mode === "view" ? "p-1" : "p-1.5"}`}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          {previewable ? (
            <PhotoView src={attachment.url}>
              <button type="button" className="block overflow-hidden rounded-[2px] border border-border/60 text-left" title={attachment.description || undefined}>
                <img src={attachment.url} alt={attachment.description || attachment.filename || `Image ${index + 1}`} className="h-20 w-full object-cover" />
              </button>
            </PhotoView>
          ) : (
            <a href={attachment.url} target="_blank" rel="noreferrer" className="block rounded-md border border-border/60 px-2 py-1.5 text-[11px] text-primary underline-offset-2 hover:underline">
              {attachment.filename || `File ${index + 1}`}
            </a>
          )}
          {mode === "edit" ? <div className="mt-1.5 text-[10px] text-muted-foreground">{attachment.filename || `${dictionary.stratmaps.images} ${index + 1}`}</div> : null}
        </div>
        {canAdmin && mode === "edit" ? <EditorIconButton icon={Trash2} label="Remove image" className="size-5 border-0 bg-transparent" onClick={onRemove} /> : null}
      </div>
      {mode === "edit" ? <EditorField label={dictionary.stratmaps.imageDescription} className="mt-1"><EditorInput value={attachment.description ?? ""} onChange={(event) => onDescriptionChange(event.target.value)} disabled={!canAdmin} placeholder={dictionary.stratmaps.imageDescriptionPlaceholder} /></EditorField> : null}
    </div>
  );
}

function isPreviewableImage(attachment: StratmapElementAttachment) {
  if (attachment.contentType?.startsWith("image/")) return true;
  return /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)$/i.test(attachment.filename ?? attachment.url);
}

function ArrowStyleSelect({ value, onChange, dictionary, disabled }: { value: StratmapArrowStyle; onChange: (value: StratmapArrowStyle) => void; dictionary: Dictionary; disabled?: boolean }) {
  return (
    <EditorSelect value={value} onChange={(event) => onChange(event.target.value as StratmapArrowStyle)} disabled={disabled}>
      <option value="none">{dictionary.stratmaps.none}</option>
      <option value="arrow">{dictionary.stratmaps.arrow}</option>
      <option value="circle">{dictionary.stratmaps.circleMarker}</option>
      <option value="square">{dictionary.stratmaps.squareMarker}</option>
    </EditorSelect>
  );
}
