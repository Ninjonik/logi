"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/app/avatar-picker";
import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import { supportedTimezones } from "@/lib/discord-timezones";
import {
  getHllMapOptions,
  getHllModeOptions,
  getHllTimeOptions,
  inferHllSelection,
  isKnownHllPresetCode,
  resolveHllPresetCode,
} from "@/lib/hll-map-presets";
import { fromDateTimeLocalInTimeZone, toDateTimeLocalInTimeZone } from "@/lib/timezone-datetime";
import { cn } from "@/lib/utils";
import { eventSchema, type EventInput } from "@/lib/validation/event";
import type { EventRecord, TopicPreset } from "@/types/domain";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
  channels: Array<DiscordSelectOption & { type: number; parentId?: string }>;
};

function FieldLabel({
                      label,
                      required,
                    }: {
  label: string;
  required?: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-1 text-sm font-medium">
      <span>{label}</span>
      {required && <span className="text-destructive font-bold">*</span>}
    </div>
  );
}

function normalizeMatchValue(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function getOutcomeLabel(outcome: "victory" | "defeat" | "draw", dictionary: Dictionary) {
  switch (outcome) {
    case "victory":
      return dictionary.event.resultVictory;
    case "defeat":
      return dictionary.event.resultDefeat;
    case "draw":
      return dictionary.event.resultDraw;
    default:
      return outcome;
  }
}

function getPresetMatch(preset: TopicPreset, eventValues: Pick<EventInput, "map" | "side" | "cap">) {
  const fields = [
    { key: "map", label: "Map", eventValue: eventValues.map, presetValue: preset.map },
    { key: "side", label: "Side", eventValue: eventValues.side, presetValue: preset.side },
    { key: "cap", label: "Point", eventValue: eventValues.cap, presetValue: preset.cap },
  ];

  const matchedFields = fields
    .filter((field) => {
      const eventValue = normalizeMatchValue(field.eventValue);
      const presetValue = normalizeMatchValue(field.presetValue);
      return Boolean(eventValue && presetValue && eventValue === presetValue);
    })
    .map((field) => field.label);

  return {
    score: matchedFields.length,
    isFullMatch: matchedFields.length === fields.length,
    label: matchedFields.join(" + "),
  };
}

function resolveTrainingEndTime(values: EventInput, timezone: string) {
  const meetingStartIso = fromDateTimeLocalInTimeZone(values.meetingStart, timezone);
  const fallbackEndIso = values.gameEnd
    ? fromDateTimeLocalInTimeZone(values.gameEnd, timezone)
    : meetingStartIso;

  const meetingStartMs = new Date(meetingStartIso).getTime();
  const fallbackEndMs = new Date(fallbackEndIso).getTime();

  if (!Number.isFinite(meetingStartMs) || !Number.isFinite(fallbackEndMs)) {
    return fallbackEndIso;
  }

  if (fallbackEndMs > meetingStartMs) {
    return fallbackEndIso;
  }

  return new Date(meetingStartMs + 90 * 60 * 1000).toISOString();
}

export function EventFormPanel({
  event,
  serverId,
  locale,
  topicPresets,
  timezone = "UTC",
  canEdit,
  dictionary,
  createMode = false,
}: {
  event: EventRecord;
  serverId: string;
  locale: string;
  topicPresets: TopicPreset[];
  timezone?: string;
  canEdit: boolean;
  dictionary: Dictionary;
  createMode?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);
  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedMapTime, setSelectedMapTime] = useState("");
  const [selectedMapMode, setSelectedMapMode] = useState("");

  const form = useForm<EventInput>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      kind: event.kind ?? "match",
      name: event.name ?? "",
      description: event.description ?? "",
      thumbnailUrl: event.thumbnailUrl ?? "",
      meetingChannelId: event.meetingChannelId ?? "",
      requiredRoleIds: event.requiredRoleIds,
      rewardRoleIds: event.rewardRoleIds,
      server: event.server ?? "",
      serverPassword: event.serverPassword ?? "",
      side: event.side ?? "",
      map: event.map ?? "",
      cap: event.cap ?? "",
      notes: event.notes ?? "",
      registrationEnd: toDateTimeLocalInTimeZone(event.registrationEnd, timezone),
      meetingStart: toDateTimeLocalInTimeZone(event.meetingStart, timezone),
      gameStart: toDateTimeLocalInTimeZone(event.gameStart, timezone),
      gameEnd: toDateTimeLocalInTimeZone(event.gameEnd, timezone),
      pingClan: event.pingClan,
      createForumChannel: event.createForumChannel,
      topicPresetId: event.topicPresetId ?? "",
    },
  });
  const eventKind = form.watch("kind");
  const detailBasePath = eventKind === "training" ? "trainings" : "matches";
  const eventName = form.watch("name");
  const sideValue = form.watch("side");
  const mapValue = form.watch("map");
  const eventMatchValues = form.watch(["map", "side", "cap"]);
  const presetMatchValues = {
    map: eventMatchValues[0],
    side: eventMatchValues[1],
    cap: eventMatchValues[2],
  };
  const meetingChannels = metadata?.channels?.filter((channel) => channel.type === 2 || channel.type === 13) ?? [];
  const mapOptions = getHllMapOptions();
  const timeOptions = selectedMapId ? getHllTimeOptions(selectedMapId) : [];
  const modeOptions = selectedMapId ? getHllModeOptions(selectedMapId, selectedMapTime) : [];

  useEffect(() => {
    if (!canEdit) return;

    fetch(`/api/servers/${serverId}/discord-metadata`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body || !Array.isArray(body.roles) || !Array.isArray(body.channels)) {
          throw new Error("Unable to load Discord metadata.");
        }
        setMetadata(body);
      })
      .catch(() => setMetadata(null));
  }, [canEdit, serverId]);

  useEffect(() => {
    if (eventKind !== "match") {
      return;
    }

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
  }, [eventKind, mapValue]);

  useEffect(() => {
    if (eventKind !== "match" || !selectedMapId || !selectedMapTime || !selectedMapMode) {
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
  }, [eventKind, form, mapValue, selectedMapId, selectedMapMode, selectedMapTime, sideValue]);

  useEffect(() => {
    if (eventKind === "training" && form.getValues("createForumChannel")) {
      form.setValue("createForumChannel", false, { shouldDirty: true, shouldTouch: true });
    }
  }, [eventKind, form]);

  function handleMapSelection(mapId: string) {
    setSelectedMapId(mapId);
    setSelectedMapTime("");
    setSelectedMapMode("");
  }

  function handleMapTimeSelection(time: string) {
    setSelectedMapTime(time);
    setSelectedMapMode("");
  }

  function handleMapModeSelection(mode: string) {
    setSelectedMapMode(mode);
  }

  async function submit(values: EventInput) {
    const payload = {
      ...values,
      registrationEnd: fromDateTimeLocalInTimeZone(values.registrationEnd, timezone),
      meetingStart: fromDateTimeLocalInTimeZone(values.meetingStart, timezone),
      gameStart: values.kind === "match"
        ? fromDateTimeLocalInTimeZone(values.gameStart ?? values.meetingStart, timezone)
        : fromDateTimeLocalInTimeZone(values.meetingStart, timezone),
      gameEnd: values.kind === "match"
        ? fromDateTimeLocalInTimeZone(values.gameEnd ?? values.gameStart ?? values.meetingStart, timezone)
        : resolveTrainingEndTime(values, timezone),
      createForumChannel: values.kind === "match" ? values.createForumChannel : false,
      topicPresetId: values.topicPresetId || undefined,
      thumbnailUrl: values.thumbnailUrl || undefined,
    };

    const response = await fetch(
      createMode ? `/api/servers/${serverId}/events` : `/api/servers/${serverId}/events/${event.id}`,
      {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? "Unable to save event.");
      form.setError("root", {
        message: body.error ?? "Unable to save event.",
      });
      return;
    }

    toast.success(createMode ? dictionary.event.created : dictionary.event.saved);
    startTransition(() => {
      router.push(`/${locale}/dashboard/servers/${serverId}/${detailBasePath}/${createMode ? body.eventId : event.id}`);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">{createMode ? dictionary.event.createTitle : dictionary.event.infoTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {createMode ? dictionary.event.createDescription : dictionary.event.infoDescription}
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          {event.kind === "match" && event.eventResult ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={event.eventResult.outcome === "victory" ? "default" : "secondary"} className="rounded-full px-3">
                  {getOutcomeLabel(event.eventResult.outcome, dictionary)}
                </Badge>
                <div className="text-lg font-semibold">
                  {event.eventResult.sideA} {event.eventResult.score.sideA} - {event.eventResult.score.sideB} {event.eventResult.sideB}
                </div>
                <div className="text-sm text-muted-foreground">
                  {event.eventResult.mapName ?? event.eventResult.mapId}
                </div>
                {event.matchStatsId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => router.push(`/${locale}/dashboard/servers/${serverId}/matches/${event.id}/match-stats`)}
                  >
                    {dictionary.event.openMatch}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <FieldLabel label={dictionary.event.fields.kind} required />
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value as EventInput["kind"])}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="match">{dictionary.sidebar.matches ?? "Matches"}</SelectItem>
                      <SelectItem value="training">{dictionary.sidebar.trainings ?? "Trainings"}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.name} required  />
              <Input {...form.register("name")} className="rounded-xl" />
              {form.formState.errors.name ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
            {eventKind === "match" ? (
              <div className="space-y-3 md:col-span-2">
                <FieldLabel label={dictionary.event.fields.map}  />
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {dictionary.event.fields.map}
                    </div>
                    <Select value={selectedMapId} onValueChange={handleMapSelection}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder={dictionary.event.fields.map} />
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
                        {dictionary.event.fields.mapVariant ?? "Variant"}
                      </div>
                      <Select value={selectedMapTime} onValueChange={handleMapTimeSelection}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder={dictionary.event.fields.mapVariant ?? "Variant"} />
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
                        {dictionary.event.fields.mapMode ?? "Mode"}
                      </div>
                      <Select value={selectedMapMode} onValueChange={handleMapModeSelection}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder={dictionary.event.fields.mapMode ?? "Mode"} />
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
                    {dictionary.event.fields.mapPresetCode ?? "Map preset code"}: <span className="font-mono">{mapValue}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="md:col-span-2">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {dictionary.serverSettings.timezone}: {supportedTimezones.includes(timezone as (typeof supportedTimezones)[number]) ? timezone : "UTC"}
              </div>
            </div>
            <div className="md:col-span-2">
              <Controller
                control={form.control}
                name="thumbnailUrl"
                render={({ field }) => (
                  <AvatarPicker
                    value={field.value || ""}
                  onChange={field.onChange}
                    fallback={eventName.slice(0, 2).toUpperCase() || "EV"}
                    label={dictionary.event.fields.thumbnail ?? "Thumbnail"}
                    buttonLabel={dictionary.common.upload}
                    disabled={!canEdit || isPending}
                    className="rounded-2xl border border-border/60 p-4"
                  />
                )}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.description}  />
              <Textarea {...form.register("description")} className="min-h-24 rounded-xl" />
            </div>
            {eventKind === "match" ? (
            <div>
              <FieldLabel label={dictionary.event.fields.side}  />
              <Input {...form.register("side")} className="rounded-xl" />
            </div>
            ) : null}
            {eventKind === "match" ? (
            <div>
              <FieldLabel label={dictionary.event.fields.capMode}  />
              <Input {...form.register("cap")} className="rounded-xl" />
            </div>
            ) : null}
            {eventKind === "match" ? (
            <div>
              <FieldLabel label={dictionary.event.fields.server}  />
              <Input {...form.register("server")} autoComplete="one-time-code" className="rounded-xl" />
            </div>
            ) : null}
            {eventKind === "match" ? (
            <div>
              <FieldLabel label={dictionary.event.fields.serverPassword}  />
              <Input {...form.register("serverPassword")} autoComplete={"new-password"} className="rounded-xl" />
            </div>
            ) : null}
            <div>
              <FieldLabel label={dictionary.event.fields.meetingChannelId ?? "Meeting VC"}  />
              <Controller
                control={form.control}
                name="meetingChannelId"
                render={({ field }) => (
                  <DiscordEntitySelect
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? "")}
                    options={meetingChannels}
                    placeholder={dictionary.event.fields.meetingChannelId ?? "Meeting VC"}
                    noneLabel={dictionary.shared.notSet}
                  />
                )}
              />
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.registrationEnd} required  />
              <Input type="datetime-local" {...form.register("registrationEnd")} className="rounded-xl" />
              {form.formState.errors.registrationEnd ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.registrationEnd.message}</p> : null}
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.meetingStart} required  />
              <Input type="datetime-local" {...form.register("meetingStart")} className="rounded-xl" />
              {form.formState.errors.meetingStart ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.meetingStart.message}</p> : null}
            </div>
            {eventKind === "match" ? (
              <>
                <div>
                  <FieldLabel label={dictionary.event.fields.gameStart} required  />
                  <Input type="datetime-local" {...form.register("gameStart")} className="rounded-xl" />
                  {form.formState.errors.gameStart ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.gameStart.message}</p> : null}
                </div>
                <div>
                  <FieldLabel label={dictionary.event.fields.gameEnd} required  />
                  <Input type="datetime-local" {...form.register("gameEnd")} className="rounded-xl" />
                  {form.formState.errors.gameEnd ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.gameEnd.message}</p> : null}
                </div>
              </>
            ) : null}
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.topicPreset}  />
              <Controller
                control={form.control}
                name="topicPresetId"
                render={({ field }) => (
                  <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{dictionary.event.noPreset}</SelectItem>
                      {topicPresets.map((preset) => {
                        const match = getPresetMatch(preset, presetMatchValues);

                        return (
                          <SelectItem
                            key={preset.id}
                            value={preset.id}
                            className={cn(
                              match.score > 0 && "bg-primary/5 font-medium",
                              match.isFullMatch && "bg-primary/10 text-primary",
                            )}
                          >
                            <span className="flex w-full min-w-0 items-center justify-between gap-3">
                              <span className="min-w-0 truncate">{preset.name}</span>
                              {match.score > 0 ? (
                                <Badge variant={match.isFullMatch ? "default" : "secondary"} className="shrink-0 rounded-md">
                                  <Check className="mr-1 size-3" />
                                  {match.isFullMatch ? dictionary.event.topicPresetCompleteMatch : dictionary.event.topicPresetPartialMatch}
                                </Badge>
                              ) : null}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            ) : null}
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.notes}  />
              <Textarea {...form.register("notes")} className="min-h-28 rounded-xl" />
            </div>
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <FieldLabel label={dictionary.event.fields.createForumChannel ?? "Create forum channel"}  />
                  <p className="text-sm text-muted-foreground">
                    {dictionary.event.createForumChannelDescription ?? "Create the Discord forum channel and its briefing topics for this event."}
                  </p>
                </div>
                <Controller
                  control={form.control}
                  name="createForumChannel"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                />
              </div>
            </div>
            ) : null}
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.requiredRoleIds ?? "Required role IDs"} />
              <Controller
                control={form.control}
                name="requiredRoleIds"
                render={({ field }) => (
                  <DiscordMultiEntitySelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                    options={metadata?.roles ?? []}
                    placeholder={dictionary.event.fields.requiredRoleIds ?? "Required role IDs"}
                  />
                )}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.rewardRoleIds ?? "Reward role IDs"} />
              <Controller
                control={form.control}
                name="rewardRoleIds"
                render={({ field }) => (
                  <DiscordMultiEntitySelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                    options={metadata?.roles ?? []}
                    placeholder={dictionary.event.fields.rewardRoleIds ?? "Reward role IDs"}
                  />
                )}
              />
            </div>
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <FieldLabel label={dictionary.event.fields.pingClan}  />
                </div>
                <Controller
                  control={form.control}
                  name="pingClan"
                  render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                />
              </div>
            </div>
            ) : null}
          </div>
          {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button className="rounded-xl" type="submit" disabled={!canEdit || isPending || form.formState.isSubmitting}>
              {dictionary.common.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
