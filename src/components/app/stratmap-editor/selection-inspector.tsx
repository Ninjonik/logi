"use client";

import { useState, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { PhotoSlider } from "react-photo-view";

import { DiscordMarkdownText, DiscordMarkdownTextarea } from "@/components/app/discord-markdown";
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
  onElementChange,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  canEdit: boolean;
  mode: "view" | "edit";
  selectedElement: StratmapElement | null;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
}) {
  if (!selectedElement) return null;
  if (selectedElement.kind === "icon") return <IconInspector dictionary={dictionary} canAdmin={canAdmin} canEdit={canEdit} mode={mode} selectedElement={selectedElement} onElementChange={onElementChange} />;
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
  onElementChange,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  canEdit: boolean;
  mode: "view" | "edit";
  selectedElement: Extract<StratmapElement, { kind: "icon" }>;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
}) {
  if (mode === "view") return null;

  return (
    <SectionCard title={dictionary.stratmaps.selectedIcon}>
      <EditorField label="Color">
        <ColorSwatches value={selectedElement.color ?? "#39ff14"} onChange={(value) => onElementChange((element) => element.kind === "icon" ? { ...element, color: value } : element)} />
      </EditorField>
      <EditorField label={dictionary.stratmaps.size}>
        <EditorInput type="number" min={16} max={160} value={selectedElement.size} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, size: Number(event.target.value) || 50 } : element)} disabled={!canAdmin && !canEdit} />
      </EditorField>
      <EditorField label={dictionary.stratmaps.notes}>
        <EditorTextarea value={selectedElement.note ?? ""} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, note: event.target.value } : element)} disabled={!canAdmin} placeholder={dictionary.stratmaps.notePlaceholder} />
      </EditorField>
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
  mainAttachmentUrl,
  fallbackNote,
  canAdmin,
  mode,
  isUploading,
  onUpload,
  onMainAttachmentChange,
  onDescriptionChange,
  onRemove,
}: {
  dictionary: Dictionary;
  attachments: StratmapElementAttachment[];
  mainAttachmentUrl?: string;
  fallbackNote?: string;
  canAdmin: boolean;
  mode: "view" | "edit";
  isUploading: boolean;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMainAttachmentChange: (url: string) => void;
  onDescriptionChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const previewAttachments = attachments.filter(isPreviewableImage);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const openAttachment = (attachment: StratmapElementAttachment) => {
    const nextIndex = previewAttachments.indexOf(attachment);
    if (nextIndex < 0) return;
    setViewerIndex(nextIndex);
    setViewerVisible(true);
  };

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
        <>
          <div className="flex flex-col gap-1.5">
            {attachments.map((attachment, index) => (
              <AttachmentCard
                key={`${attachment.url}-${index}`}
                attachment={attachment}
                index={index}
                dictionary={dictionary}
                canAdmin={canAdmin}
                mode={mode}
                isMain={(mainAttachmentUrl ?? attachments[0]?.url) === attachment.url}
                fallbackNote={fallbackNote}
                onOpen={() => openAttachment(attachment)}
                onMainAttachmentChange={() => onMainAttachmentChange(attachment.url)}
                onDescriptionChange={(value) => onDescriptionChange(index, value)}
                onRemove={() => onRemove(index)}
              />
            ))}
          </div>
          <PhotoSlider
            images={previewAttachments.map((attachment, index) => ({ key: `${attachment.url}-${index}`, src: attachment.url }))}
            index={viewerIndex}
            visible={viewerVisible}
            onIndexChange={setViewerIndex}
            onClose={() => setViewerVisible(false)}
            loop
            maskOpacity={0.92}
            overlayRender={({ index }) => <LightboxCaption text={getAttachmentCaption(previewAttachments[index], fallbackNote)} />}
          />
        </>
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
  isMain,
  fallbackNote,
  onOpen,
  onMainAttachmentChange,
  onDescriptionChange,
  onRemove,
}: {
  attachment: StratmapElementAttachment;
  index: number;
  dictionary: Dictionary;
  canAdmin: boolean;
  mode: "view" | "edit";
  isMain: boolean;
  fallbackNote?: string;
  onOpen: () => void;
  onMainAttachmentChange: () => void;
  onDescriptionChange: (value: string) => void;
  onRemove: () => void;
}) {
  const previewable = isPreviewableImage(attachment);
  const caption = getAttachmentCaption(attachment, fallbackNote);

  return (
    <div className={cn("min-w-0 overflow-hidden rounded-[3px] border p-1.5", isMain ? "border-primary/70 bg-primary/5" : "border-border/60")}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          {previewable ? (
            <div className="relative overflow-hidden rounded-[2px] border border-border/60">
              <button type="button" onClick={onOpen} className="block w-full text-left" title={caption || undefined}>
                <img src={attachment.url} alt={caption || attachment.filename || `Image ${index + 1}`} className="h-28 w-full object-cover" />
              </button>
              {caption ? <ThumbnailCaption text={caption} /> : null}
            </div>
          ) : (
            <a href={attachment.url} target="_blank" rel="noreferrer" className="block rounded-md border border-border/60 px-2 py-1.5 text-[11px] text-primary underline-offset-2 hover:underline">
              {attachment.filename || `File ${index + 1}`}
            </a>
          )}
          <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
            <div className="truncate text-[9px] text-muted-foreground">{attachment.filename || `${dictionary.stratmaps.images} ${index + 1}`}</div>
            {canAdmin && mode === "edit" ? (
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[9px] font-medium text-foreground/80">
                <input type="radio" name="stratmap-main-image" checked={isMain} onChange={onMainAttachmentChange} className="size-3 accent-primary" />
                {dictionary.stratmaps.mainImage}
              </label>
            ) : null}
          </div>
        </div>
        {canAdmin && mode === "edit" ? <EditorIconButton icon={Trash2} label="Remove image" className="size-5 border-0 bg-transparent" onClick={onRemove} /> : null}
      </div>
      {mode === "edit" ? (
        <EditorField label={dictionary.stratmaps.imageDescription} className="mt-1">
          <DiscordMarkdownTextarea
            value={attachment.description ?? ""}
            onChange={onDescriptionChange}
            disabled={!canAdmin}
            placeholder={dictionary.stratmaps.imageDescriptionPlaceholder}
            height={116}
            preview="edit"
            compactToolbar
            className="rounded-[3px] shadow-none focus-within:ring-1 [&>.w-md-editor>.w-md-editor-toolbar]:min-h-7 [&>.w-md-editor>.w-md-editor-toolbar]:px-1 [&>.w-md-editor>.w-md-editor-toolbar]:py-0.5 [&>.w-md-editor>.w-md-editor-toolbar_button]:h-6 [&>.w-md-editor>.w-md-editor-toolbar_button]:px-1"
          />
        </EditorField>
      ) : null}
    </div>
  );
}

function getAttachmentCaption(attachment: StratmapElementAttachment | undefined, fallbackNote?: string) {
  return attachment?.description?.trim() || fallbackNote?.trim() || "";
}

function ThumbnailCaption({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 max-h-24 overflow-hidden bg-gradient-to-t from-black/95 via-black/75 to-transparent px-2 pt-5 pb-1.5 text-center text-white">
      <DiscordMarkdownText
        markdown={text}
        className="text-[10px] leading-snug text-white [&_a]:!text-white [&_blockquote]:border-white/40 [&_blockquote]:text-white/80 [&_li]:ml-3 [&_ol]:pl-3 [&_p]:m-0 [&_ul]:pl-3"
      />
    </div>
  );
}

export function LightboxCaption({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-5 z-50 flex justify-center">
      <div className="pointer-events-auto max-h-[35vh] max-w-3xl overflow-y-auto rounded-md border border-white/15 bg-black/80 px-4 py-2 text-center text-white shadow-2xl backdrop-blur-sm">
        <DiscordMarkdownText
          markdown={text}
          className="text-sm leading-relaxed text-white [&_a]:!text-white [&_blockquote]:border-white/40 [&_blockquote]:text-white/80"
        />
      </div>
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
