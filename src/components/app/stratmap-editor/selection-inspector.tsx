"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { PhotoProvider, PhotoView } from "react-photo-view";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StratmapElement, StratmapElementAttachment } from "@/lib/stratmaps";

export function SelectionInspector({
  dictionary,
  canAdmin,
  strokeColor,
  selectedElement,
  isUploadingIconAttachments,
  onElementChange,
  onUpload,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  strokeColor: string;
  selectedElement: StratmapElement | null;
  isUploadingIconAttachments: boolean;
  onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!selectedElement) return null;
  if (canAdmin && selectedElement.kind === "icon") return <IconInspector {...{ dictionary, strokeColor, selectedElement, isUploadingIconAttachments, onElementChange, onUpload }} />;
  if (canAdmin && selectedElement.kind === "text") return <TextInspector {...{ dictionary, selectedElement, onElementChange }} />;
  return <Card className="rounded-xl border-border/60"><CardHeader className="px-3 py-3"><CardTitle className="text-base">{dictionary.stratmaps.selectedElement}</CardTitle></CardHeader><CardContent className="px-3 pb-3 text-xs text-muted-foreground">{dictionary.stratmaps.selectedElementHint}</CardContent></Card>;
}

function IconInspector(props: { dictionary: Dictionary; strokeColor: string; selectedElement: Extract<StratmapElement, { kind: "icon" }>; isUploadingIconAttachments: boolean; onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void; onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void; }) {
  const { dictionary, strokeColor, selectedElement, isUploadingIconAttachments, onElementChange, onUpload } = props;
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const attachments = selectedElement.attachments ?? [];
  const activeAttachment = attachments[lightboxIndex];

  return (
    <Card className="rounded-xl border-border/60">
      <CardHeader className="px-3 py-3"><CardTitle className="text-base">{dictionary.stratmaps.selectedIcon}</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.size}</Label><Input type="number" min={24} max={160} value={selectedElement.size} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, size: Number(event.target.value) || 24 } : element)} className="h-9 rounded-lg text-sm" /></div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.notes}</Label><Textarea value={selectedElement.note ?? ""} onChange={(event) => onElementChange((element) => element.kind === "icon" ? { ...element, note: event.target.value } : element)} className="min-h-24 rounded-lg px-3 py-2 text-sm" placeholder={dictionary.stratmaps.notePlaceholder} /></div>
        <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={() => onElementChange((element) => element.kind === "icon" ? { ...element, color: strokeColor } : element)}>{dictionary.stratmaps.stroke}</Button>
        <div className="space-y-1.5">
          <Label className="text-xs">{dictionary.stratmaps.images}</Label>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"><ImagePlus className="size-4" />{isUploadingIconAttachments ? dictionary.stratmaps.uploading : dictionary.stratmaps.attachImages}<input type="file" multiple accept="image/*" className="sr-only" onChange={onUpload} /></label>
          {!attachments.length ? <div className="text-xs text-muted-foreground">{dictionary.stratmaps.noImages}</div> : null}
          {attachments.length ? (
            <PhotoProvider
              loop
              maskOpacity={0.92}
              onIndexChange={(index) => setLightboxIndex(index)}
              overlayRender={() => activeAttachment?.description ? (
                <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex justify-center">
                  <div className="max-w-3xl rounded-xl border border-white/15 bg-black/70 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">
                    {activeAttachment.description}
                  </div>
                </div>
              ) : null}
            >
              <div className="space-y-3">
                {attachments.map((attachment, index) => (
                  <AttachmentCard
                    key={`${attachment.url}-${index}`}
                    attachment={attachment}
                    index={index}
                    dictionary={dictionary}
                    onDescriptionChange={(value) =>
                      onElementChange((element) =>
                        element.kind === "icon"
                          ? {
                              ...element,
                              attachments: (element.attachments ?? []).map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, description: value } : entry,
                              ),
                            }
                          : element,
                      )}
                    onRemove={() =>
                      onElementChange((element) =>
                        element.kind === "icon"
                          ? { ...element, attachments: (element.attachments ?? []).filter((_, attachmentIndex) => attachmentIndex !== index) }
                          : element,
                      )}
                  />
                ))}
              </div>
            </PhotoProvider>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AttachmentCard({
  attachment,
  index,
  dictionary,
  onDescriptionChange,
  onRemove,
}: {
  attachment: StratmapElementAttachment;
  index: number;
  dictionary: Dictionary;
  onDescriptionChange: (value: string) => void;
  onRemove: () => void;
}) {
  const previewable = isPreviewableImage(attachment);

  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {previewable ? (
            <PhotoView src={attachment.url}>
              <button type="button" className="block overflow-hidden rounded-lg border border-border/60 text-left">
                <img src={attachment.url} alt={attachment.description || attachment.filename || `Image ${index + 1}`} className="h-32 w-full object-cover" />
              </button>
            </PhotoView>
          ) : (
            <a href={attachment.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border/60 px-3 py-2 text-xs text-primary underline-offset-2 hover:underline">
              {attachment.filename || `File ${index + 1}`}
            </a>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            {attachment.filename || `${dictionary.stratmaps.images} ${index + 1}`}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label className="text-xs">{dictionary.stratmaps.imageDescription}</Label>
        <Textarea
          value={attachment.description ?? ""}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={dictionary.stratmaps.imageDescriptionPlaceholder}
          className="min-h-20 rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function isPreviewableImage(attachment: StratmapElementAttachment) {
  if (attachment.contentType?.startsWith("image/")) {
    return true;
  }

  return /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)$/i.test(attachment.filename ?? attachment.url);
}

function TextInspector({ dictionary, selectedElement, onElementChange }: { dictionary: Dictionary; selectedElement: Extract<StratmapElement, { kind: "text" }>; onElementChange: (updater: (element: StratmapElement) => StratmapElement) => void; }) {
  return (
    <Card className="rounded-xl border-border/60">
      <CardHeader className="px-3 py-3"><CardTitle className="text-base">{dictionary.stratmaps.selectedElement}</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.text}</Label><Textarea value={selectedElement.text} onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, text: event.target.value } : element)} className="min-h-20 rounded-lg px-3 py-2 text-sm" /></div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.fontSize}</Label><Input type="number" min={16} max={96} value={selectedElement.fontSize} onChange={(event) => onElementChange((element) => element.kind === "text" ? { ...element, fontSize: Number(event.target.value) || 16 } : element)} className="h-9 rounded-lg text-sm" /></div>
      </CardContent>
    </Card>
  );
}
