"use client";

import { useState, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { PhotoProvider, PhotoView } from "react-photo-view";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StratmapArrowStyle, StratmapElement, StratmapElementAttachment } from "@/lib/stratmaps";

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
  if (selectedElement.kind === "icon") return <IconInspector {...{ dictionary, canAdmin, canEdit, mode, selectedElement, isUploadingIconAttachments, onElementChange, onUpload }} />;
  if (selectedElement.kind === "text") return <TextInspector {...{ dictionary, canAdmin, selectedElement, onElementChange }} />;
  if (selectedElement.kind === "line") return <LineInspector {...{ dictionary, canAdmin, selectedElement, onElementChange }} />;
  if (selectedElement.kind === "rectangle" || selectedElement.kind === "ellipse" || selectedElement.kind === "polygon" || selectedElement.kind === "freehand") {
    return <ShapeInspector {...{ dictionary, canAdmin, selectedElement, onElementChange }} />;
  }
  return null;
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`h-7 w-7 rounded-full border-2 ${value === color ? "border-primary" : "border-border/60"}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
      <CardHeader className="px-3 py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-hidden px-3 pb-3">{children}</CardContent>
    </Card>
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
      <div className="space-y-1.5">
        <Label className="text-xs">Color</Label>
        <ColorSwatches value={selectedElement.color ?? "#39ff14"} onChange={(value) => onElementChange((element) => element.kind === "icon" ? { ...element, color: value } : element)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{dictionary.stratmaps.size}</Label>
        <Input type="number" min={16} max={160} value={selectedElement.size} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, size: Number(event.target.value) || 30 } : element)} disabled={!canAdmin && !canEdit} className="h-9 min-w-0 overflow-hidden rounded-lg text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{dictionary.stratmaps.notes}</Label>
        <Textarea value={selectedElement.note ?? ""} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, note: event.target.value } : element)} disabled={!canAdmin} className="min-h-20 rounded-lg px-3 py-2 text-sm" placeholder={dictionary.stratmaps.notePlaceholder} />
      </div>
      <AttachmentGallery dictionary={dictionary} attachments={selectedElement.attachments ?? []} canAdmin={canAdmin} mode="edit" isUploading={isUploadingIconAttachments} onUpload={onUpload} onDescriptionChange={() => undefined} onRemove={() => undefined} />
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
      <div className="space-y-1.5">
        <Label className="text-xs">Color</Label>
        <ColorSwatches value={stroke} onChange={(value) => onElementChange((element) => element.id === selectedElement.id ? { ...element, strokeColor: value, fillColor: element.fillColor?.startsWith("rgba") ? `${value}33` : element.fillColor } : element)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.strokeWidth}</Label><Input type="number" min={1} max={24} value={selectedElement.strokeWidth ?? 6} onChange={(event) => onElementChange((element) => element.id === selectedElement.id ? { ...element, strokeWidth: Number(event.target.value) || 1 } : element)} disabled={!canAdmin} className="h-9 rounded-lg text-sm" /></div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.fill}</Label><Input type="color" value={fill.slice(0, 7)} onChange={(event) => onElementChange((element) => element.id === selectedElement.id ? { ...element, fillColor: `${event.target.value}33` } : element)} disabled={!canAdmin} className="h-9 rounded-lg p-1" /></div>
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
      <div className="space-y-1.5">
        <Label className="text-xs">Color</Label>
        <ColorSwatches value={selectedElement.color ?? "#39ff14"} onChange={(value) => onElementChange((element) => element.kind === "text" ? { ...element, color: value } : element)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Background</Label>
        <Input
          type="color"
          value={selectedElement.backgroundColor && selectedElement.backgroundColor !== "transparent" ? selectedElement.backgroundColor.slice(0, 7) : "#000000"}
          onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, backgroundColor: `${event.target.value}cc` } : element)}
          disabled={!canAdmin}
          className="h-9 rounded-lg p-1"
        />
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-lg px-3 text-xs"
          onClick={() => onElementChange((element) => element.kind === "text" ? { ...element, backgroundColor: "transparent" } : element)}
          disabled={!canAdmin}
        >
          Transparent
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{dictionary.stratmaps.text}</Label>
        <Textarea value={selectedElement.text} onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, text: event.target.value } : element)} disabled={!canAdmin} className="min-h-20 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{dictionary.stratmaps.fontSize}</Label>
        <Input type="number" min={16} max={96} value={selectedElement.fontSize} onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, fontSize: Number(event.target.value) || 16 } : element)} disabled={!canAdmin} className="h-9 min-w-0 overflow-hidden rounded-lg text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Alignment</Label>
        <Select value={selectedElement.align ?? "left"} onValueChange={(value) => onElementChange((element) => element.kind === "text" ? { ...element, align: value as "left" | "center" | "right" } : element)} disabled={!canAdmin}>
          <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
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
      <div className="space-y-1.5">
        <Label className="text-xs">{dictionary.stratmaps.color}</Label>
        <ColorSwatches value={selectedElement.strokeColor ?? "#39ff14"} onChange={(value) => onElementChange((element) => element.kind === "line" ? { ...element, strokeColor: value } : element)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{dictionary.stratmaps.strokeWidth}</Label>
        <Input type="number" min={1} max={24} value={selectedElement.strokeWidth ?? 6} onChange={(event) => onElementChange((element) => element.kind === "line" ? { ...element, strokeWidth: Number(event.target.value) || 1 } : element)} disabled={!canAdmin} className="h-9 min-w-0 overflow-hidden rounded-lg text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.lineStart}</Label><ArrowStyleSelect value={selectedElement.startStyle ?? "none"} onChange={(value) => onElementChange((element) => element.kind === "line" ? { ...element, startStyle: value } : element)} dictionary={dictionary} disabled={!canAdmin} /></div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.lineEnd}</Label><ArrowStyleSelect value={selectedElement.endStyle ?? "arrow"} onChange={(value) => onElementChange((element) => element.kind === "line" ? { ...element, endStyle: value } : element)} dictionary={dictionary} disabled={!canAdmin} /></div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
        <Label className="text-xs">{dictionary.stratmaps.showDistance}</Label>
        <Switch checked={selectedElement.showDistance ?? false} onCheckedChange={(checked) => onElementChange((element) => element.kind === "line" ? { ...element, showDistance: checked } : element)} disabled={!canAdmin} />
      </div>
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
    <div className="space-y-3">
      {canAdmin && mode === "edit" ? (
        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
          <ImagePlus className="size-4" />
          {isUploading ? dictionary.stratmaps.uploading : dictionary.stratmaps.attachImages}
          <input type="file" multiple accept="image/*" className="sr-only" onChange={onUpload} />
        </label>
      ) : null}
      {!attachments.length ? <div className="text-xs text-muted-foreground">{dictionary.stratmaps.noImages}</div> : null}
      {attachments.length ? (
        <PhotoProvider loop maskOpacity={0.92} onIndexChange={(index) => setLightboxIndex(index)} overlayRender={() => activeAttachment?.description ? <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex justify-center"><div className="max-w-3xl rounded-xl border border-white/15 bg-black/70 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">{activeAttachment.description}</div></div> : null}>
          <div className={mode === "view" ? "grid grid-cols-2 gap-2" : "space-y-3"}>
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
    <div className={`min-w-0 overflow-hidden rounded-xl border border-border/60 ${mode === "view" ? "p-2" : "p-3"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {previewable ? (
            <PhotoView src={attachment.url}>
              <button type="button" className="block overflow-hidden rounded-lg border border-border/60 text-left" title={attachment.description || undefined}>
                <img src={attachment.url} alt={attachment.description || attachment.filename || `Image ${index + 1}`} className={mode === "view" ? "h-28 w-full object-cover" : "h-32 w-full object-cover"} />
              </button>
            </PhotoView>
          ) : (
            <a href={attachment.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border/60 px-3 py-2 text-xs text-primary underline-offset-2 hover:underline">
              {attachment.filename || `File ${index + 1}`}
            </a>
          )}
          {mode === "edit" ? <div className="mt-2 text-xs text-muted-foreground">{attachment.filename || `${dictionary.stratmaps.images} ${index + 1}`}</div> : null}
        </div>
        {canAdmin && mode === "edit" ? <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg" onClick={onRemove}><Trash2 className="size-4" /></Button> : null}
      </div>
      {mode === "edit" ? <div className="mt-3 space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.imageDescription}</Label><Input value={attachment.description ?? ""} onChange={(event) => onDescriptionChange(event.target.value)} disabled={!canAdmin} placeholder={dictionary.stratmaps.imageDescriptionPlaceholder} className="h-9 rounded-lg px-3 text-sm" /></div> : null}
    </div>
  );
}

function isPreviewableImage(attachment: StratmapElementAttachment) {
  if (attachment.contentType?.startsWith("image/")) return true;
  return /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)$/i.test(attachment.filename ?? attachment.url);
}

function ArrowStyleSelect({ value, onChange, dictionary, disabled }: { value: StratmapArrowStyle; onChange: (value: StratmapArrowStyle) => void; dictionary: Dictionary; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as StratmapArrowStyle)} disabled={disabled}>
      <SelectTrigger className="h-9 min-w-0 overflow-hidden rounded-lg text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{dictionary.stratmaps.none}</SelectItem>
        <SelectItem value="arrow">{dictionary.stratmaps.arrow}</SelectItem>
        <SelectItem value="circle">{dictionary.stratmaps.circleMarker}</SelectItem>
        <SelectItem value="square">{dictionary.stratmaps.squareMarker}</SelectItem>
      </SelectContent>
    </Select>
  );
}
