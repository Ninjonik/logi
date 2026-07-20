"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Paperclip, Plus, Save, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  getHllMapOptions,
  getHllModeOptions,
  getHllTimeOptions,
  inferHllSelection,
  resolveHllPresetCode,
} from "@/lib/hll-map-presets";
import { topicPresetSchema, type TopicPresetInput } from "@/lib/validation/topic-preset";
import type { TopicPreset } from "@/types/domain";

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-1 text-sm font-medium">
      <span>{label}</span>
      {required ? <span className="font-bold text-destructive">*</span> : null}
    </div>
  );
}

function newTopic(title = "") {
  return {
    id: crypto.randomUUID(),
    title,
    body: "",
    attachments: [],
  };
}

function getFirstErrorMessage(errors: FieldErrors<TopicPresetInput>): string | undefined {
  if (typeof errors.name?.message === "string") return errors.name.message;
  if (typeof errors.topics?.message === "string") return errors.topics.message;
  if (typeof errors.topics?.root?.message === "string") return errors.topics.root.message;

  if (Array.isArray(errors.topics)) {
    for (const topic of errors.topics) {
      if (typeof topic?.title?.message === "string") return topic.title.message;
      if (typeof topic?.body?.message === "string") return topic.body.message;
      if (typeof topic?.attachments?.message === "string") return topic.attachments.message;
      if (Array.isArray(topic?.attachments)) {
        for (const attachment of topic.attachments) {
          if (typeof attachment?.message === "string") return attachment.message;
        }
      }
    }
  }

  return undefined;
}

async function uploadAttachment(file: File) {
  const uploadResponse = await fetch("/api/uploads", { method: "POST" });
  const uploadBody = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(uploadBody.error ?? "Unable to prepare the upload.");
  }

  const storageResponse = await fetch(uploadBody.uploadUrl, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  const storageBody = await storageResponse.json();
  if (!storageResponse.ok) {
    throw new Error("Unable to upload the file.");
  }

  const urlResponse = await fetch("/api/uploads/url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storageId: storageBody.storageId, filename: file.name }),
  });
  const urlBody = await urlResponse.json();
  if (!urlResponse.ok) {
    throw new Error(urlBody.error ?? "Unable to read the uploaded file URL.");
  }

  return urlBody.url as string;
}

export function TopicPresetForm({
  preset,
  serverId,
  locale,
  canEdit,
  dictionary,
  createMode = false,
}: {
  preset?: TopicPreset;
  serverId: string;
  locale: string;
  canEdit: boolean;
  dictionary: Dictionary;
  createMode?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedMapTime, setSelectedMapTime] = useState("");
  const [selectedMapMode, setSelectedMapMode] = useState("");

  const form = useForm<TopicPresetInput>({
    resolver: zodResolver(topicPresetSchema),
    defaultValues: {
      name: preset?.name ?? "",
      map: preset?.map ?? "",
      side: preset?.side ?? "",
      cap: preset?.cap ?? "",
      notes: preset?.notes ?? "",
      topics: preset?.topics.length ? preset.topics.map((topic) => ({ ...topic, id: topic.id ?? crypto.randomUUID() })) : [newTopic(dictionary.presets.newTopic)],
    },
  });
  const mapValue = form.watch("map");
  const sideValue = form.watch("side");
  const mapOptions = getHllMapOptions();
  const timeOptions = selectedMapId ? getHllTimeOptions(selectedMapId) : [];
  const modeOptions = selectedMapId ? getHllModeOptions(selectedMapId, selectedMapTime) : [];

  const topics = useFieldArray({
    control: form.control,
    name: "topics",
  });

  useEffect(() => {
    const inferredSelection = inferHllSelection(mapValue);
    if (inferredSelection) {
      setSelectedMapId(inferredSelection.mapId);
      setSelectedMapTime(inferredSelection.time);
      setSelectedMapMode(inferredSelection.mode);
      return;
    }

    setSelectedMapId("");
    setSelectedMapTime("");
    setSelectedMapMode("");
  }, [mapValue]);

  useEffect(() => {
    if (!selectedMapId || !selectedMapTime || !selectedMapMode) {
      return;
    }

    const resolvedCode = resolveHllPresetCode({
      mapId: selectedMapId,
      time: selectedMapTime,
      mode: selectedMapMode,
      side: sideValue,
    });

    if (resolvedCode && resolvedCode !== mapValue) {
      form.setValue("map", resolvedCode, { shouldDirty: true, shouldTouch: true });
    }
  }, [form, mapValue, selectedMapId, selectedMapMode, selectedMapTime, sideValue]);

  function handleMapSelection(mapId: string) {
    setSelectedMapId(mapId);
    setSelectedMapTime("");
    setSelectedMapMode("");
    form.setValue("map", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }

  function handleMapTimeSelection(time: string) {
    setSelectedMapTime(time);
    setSelectedMapMode("");
    form.setValue("map", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }

  function handleMapModeSelection(mode: string) {
    setSelectedMapMode(mode);
  }

  async function submit(values: TopicPresetInput) {
    const response = await fetch(
      createMode ? `/api/servers/${serverId}/topic-presets` : `/api/servers/${serverId}/topic-presets/${preset?.id}`,
      {
        method: createMode ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      const message = body.error ?? "Unable to save the topic preset.";
      form.setError("root", { message });
      toast.error(message);
      return;
    }

    toast.success(dictionary.common.save);
    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${serverId}/topic-presets/${createMode ? body.presetId : preset?.id}`);
      router.refresh();
    });
  }

  async function handleUpload(topicIndex: number, files: FileList | null) {
    if (!files?.length) return;

    try {
      for (const file of Array.from(files)) {
        const url = await uploadAttachment(file);
        const current = form.getValues(`topics.${topicIndex}.attachments`) ?? [];
        form.setValue(`topics.${topicIndex}.attachments`, [...current, url], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      toast.success(dictionary.common.save);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.common.error);
    }
  }

  const disabled = !canEdit || isPending || form.formState.isSubmitting;

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">{createMode ? dictionary.presets.createTopicTitle : dictionary.presets.presetDetails}</CardTitle>
        <p className="text-sm text-muted-foreground">{dictionary.presets.topicPresetPageDescription}</p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(submit, (errors) => {
            const message = getFirstErrorMessage(errors) ?? dictionary.common.error;
            form.setError("root", { message });
            toast.error(message);
          })}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel label={dictionary.presets.fields.name} required />
              <Input {...form.register("name")} className="rounded-xl" disabled={!canEdit} />
              {form.formState.errors.name ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
            <div className="space-y-3 md:col-span-2">
              <FieldLabel label={dictionary.presets.fields.map} />
              <div className="grid gap-3 md:grid-cols-3">
                <div className="min-w-0 space-y-2">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {dictionary.presets.fields.map}
                  </div>
                  <Select value={selectedMapId} onValueChange={handleMapSelection} disabled={!canEdit}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder={dictionary.presets.fields.map} />
                    </SelectTrigger>
                    <SelectContent>
                      {mapOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedMapId ? (
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {dictionary.event.fields.mapVariant}
                    </div>
                    <Select value={selectedMapTime} onValueChange={handleMapTimeSelection} disabled={!canEdit}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder={dictionary.event.fields.mapVariant} />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {selectedMapId && selectedMapTime ? (
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {dictionary.event.fields.mapMode}
                    </div>
                    <Select value={selectedMapMode} onValueChange={handleMapModeSelection} disabled={!canEdit}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder={dictionary.event.fields.mapMode} />
                      </SelectTrigger>
                      <SelectContent>
                        {modeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
              {mapValue ? (
                <p className="text-xs text-muted-foreground">
                  {dictionary.event.fields.mapPresetCode}: <span className="font-mono">{mapValue}</span>
                </p>
              ) : null}
            </div>
            <div>
              <FieldLabel label={dictionary.presets.fields.side} />
              <Input {...form.register("side")} className="rounded-xl" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel label={dictionary.presets.fields.cap} />
              <Input {...form.register("cap")} className="rounded-xl" disabled={!canEdit} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.presets.fields.notes} />
              <Textarea {...form.register("notes")} className="min-h-24 rounded-xl" disabled={!canEdit} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{dictionary.presets.topics}</h3>
                <p className="text-sm text-muted-foreground">{dictionary.presets.topicEditorDescription}</p>
              </div>
              {canEdit ? (
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => topics.append(newTopic(dictionary.presets.newTopic))}>
                  <Plus className="size-4" />
                  {dictionary.presets.addTopic}
                </Button>
              ) : null}
            </div>

            {topics.fields.map((topic, topicIndex) => (
              <div key={topic.id} className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      {...form.register(`topics.${topicIndex}.title`)}
                      className="h-10 rounded-lg border-border/60 bg-background"
                      placeholder={dictionary.presets.newTopic}
                      disabled={!canEdit}
                    />
                    {form.formState.errors.topics?.[topicIndex]?.title ? (
                      <p className="mt-2 text-sm text-destructive">{form.formState.errors.topics[topicIndex]?.title?.message}</p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <Button type="button" variant="ghost" size="icon" className="mt-0.5 rounded-lg" onClick={() => topics.remove(topicIndex)} disabled={topics.fields.length <= 1}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  {...form.register(`topics.${topicIndex}.body`)}
                  className="min-h-24 rounded-lg border-border/60 bg-background"
                  placeholder={dictionary.presets.topicEditorDescription}
                  disabled={!canEdit}
                />
                <Controller
                  control={form.control}
                  name={`topics.${topicIndex}.attachments`}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <Textarea
                        value={field.value.join("\n")}
                        onChange={(event) => field.onChange(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
                        className="min-h-20 rounded-lg border-border/60 bg-background text-sm"
                        placeholder={dictionary.presets.attachmentPlaceholder}
                        disabled={!canEdit}
                      />
                      {form.formState.errors.topics?.[topicIndex]?.attachments ? (
                        <p className="text-sm text-destructive">{form.formState.errors.topics[topicIndex]?.attachments?.message}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit ? (
                          <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                            <Upload className="size-4" />
                            {dictionary.common.upload}
                            <input
                              type="file"
                              multiple
                              className="sr-only"
                              onChange={(event) => {
                                void handleUpload(topicIndex, event.target.files);
                                event.target.value = "";
                              }}
                            />
                          </label>
                        ) : null}
                        {field.value.length ? (
                          <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-muted-foreground">
                            <Paperclip className="size-3" />
                            {field.value.length} {dictionary.presets.attachmentCountSuffix}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                />
              </div>
            ))}
          </div>

          {form.formState.errors.topics?.root ? <p className="text-sm text-destructive">{form.formState.errors.topics.root.message}</p> : null}
          {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button className="rounded-xl" type="submit" disabled={disabled}>
              {form.formState.isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {dictionary.common.save}
            </Button>
            {!canEdit ? <p className="self-center text-sm text-muted-foreground">{dictionary.common.adminOnly}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
