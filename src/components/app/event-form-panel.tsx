"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/app/avatar-picker";
import { ConfigNotice } from "@/components/app/config-notice";
import { DiscordEntitySelect, type DiscordSelectOption } from "@/components/app/discord-entity-select";
import { DiscordMarkdownText, DiscordMarkdownTextarea } from "@/components/app/discord-markdown";
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select";
import { EmojiValue } from "@/components/app/emoji-value";
import { HllMapSelector } from "@/components/app/hll-map-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Dictionary } from "@/i18n/dictionaries";
import { supportedTimezones } from "@/lib/discord-timezones";
import { getEventCategoryLabel } from "@/lib/event-categories";
import {
  formatHllPresetLabel,
  inferHllBaseMapId,
  inferHllSelection,
  resolveHllPresetCode,
} from "@/lib/hll-map-presets";
import { fromDateTimeLocalInTimeZone, toDateTimeLocalInTimeZone } from "@/lib/timezone-datetime";
import { cn } from "@/lib/utils";
import { eventSchema, type EventInput } from "@/lib/validation/event";
import type { DiscordConfig, EventCategory, EventRecord, Group, StratmapRecord, TopicPreset } from "@/types/domain";

type DiscordMetadata = {
  roles: DiscordSelectOption[];
  channels: Array<DiscordSelectOption & { type: number; parentId?: string }>;
};

type TopicPresetOption = {
  preset: TopicPreset;
  match: ReturnType<typeof getPresetMatch>;
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

type TopicPresetMatchContext = {
  mapCode?: string;
  mapId?: string;
  time?: string;
  mode?: string;
  side?: string;
  cap?: string;
};

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

function getPresetMatch(preset: TopicPreset, context: TopicPresetMatchContext) {
  const presetSelection = inferHllSelection(preset.map);
  const presetMapId = presetSelection?.mapId ?? inferHllBaseMapId(preset.map);
  const hasComparableMapCode = Boolean(context.mapCode && preset.map);
  const hasComparableMapId = Boolean(context.mapId && presetMapId);
  const hasComparableTime = Boolean(context.time && presetSelection?.time);
  const hasComparableMode = Boolean(context.mode && presetSelection?.mode);
  const hasComparableSide = Boolean(context.side && preset.side);
  const hasComparableCap = Boolean(context.cap && preset.cap);

  const exactMapCodeMatch = hasComparableMapCode && normalizeMatchValue(context.mapCode) === normalizeMatchValue(preset.map);
  const mapIdMatch = hasComparableMapId && context.mapId === presetMapId;
  const timeMatch = hasComparableTime && context.time === presetSelection?.time;
  const modeMatch = hasComparableMode && context.mode === presetSelection?.mode;
  const sideMatch = hasComparableSide && normalizeMatchValue(context.side) === normalizeMatchValue(preset.side);
  const capMatch = hasComparableCap && normalizeMatchValue(context.cap) === normalizeMatchValue(preset.cap);

  const matchedFields = [
    exactMapCodeMatch || mapIdMatch ? "Map" : null,
    timeMatch ? "Time" : null,
    modeMatch ? "Mode" : null,
    sideMatch ? "Side" : null,
    capMatch ? "Point" : null,
  ].filter((value): value is string => Boolean(value));

  const score =
    (exactMapCodeMatch ? 200 : 0) +
    (mapIdMatch ? 120 : 0) +
    (modeMatch ? 30 : 0) +
    (timeMatch ? 20 : 0) +
    (sideMatch ? 8 : 0) +
    (capMatch ? 4 : 0);

  const comparableFieldCount = [
    hasComparableMapCode || hasComparableMapId,
    hasComparableTime,
    hasComparableMode,
    hasComparableSide,
    hasComparableCap,
  ].filter(Boolean).length;

  return {
    score,
    isFullMatch: comparableFieldCount > 0 && matchedFields.length === comparableFieldCount,
    label: matchedFields.join(" + "),
    metaLabel: formatHllPresetLabel(preset.map) ?? preset.map ?? "",
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

function TopicPresetSelect({
  value,
  onChange,
  options,
  dictionary,
}: {
  value?: string;
  onChange: (value: string) => void;
  options: TopicPresetOption[];
  dictionary: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(({ preset }) => preset.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-auto w-full justify-between rounded-xl py-3">
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className="truncate font-medium">
              {selectedOption?.preset.name ?? dictionary.event.noPreset}
            </span>
            {selectedOption?.match.metaLabel ? (
              <span className="truncate text-xs text-muted-foreground">{selectedOption.match.metaLabel}</span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder={dictionary.event.topicPreset} />
          <CommandList>
            <CommandEmpty>{dictionary.shared.noMatchingResults}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={dictionary.event.noPreset}
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 size-4", !value ? "opacity-100" : "opacity-0")} />
                {dictionary.event.noPreset}
              </CommandItem>
              {options.map(({ preset, match }) => (
                <CommandItem
                  key={preset.id}
                  value={[preset.name, match.metaLabel, preset.side, preset.cap, preset.map].filter(Boolean).join(" ")}
                  onSelect={() => {
                    onChange(preset.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 mt-0.5 size-4 shrink-0", value === preset.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{preset.name}</div>
                      {match.metaLabel ? (
                        <div className="truncate text-xs text-muted-foreground">{match.metaLabel}</div>
                      ) : null}
                    </div>
                    {match.score > 0 ? (
                      <Badge
                        variant={match.isFullMatch ? "default" : "secondary"}
                        className="shrink-0 rounded-md"
                      >
                        {match.isFullMatch ? dictionary.event.topicPresetCompleteMatch : dictionary.event.topicPresetPartialMatch}
                      </Badge>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ReadOnlyValue({
  value,
  emptyLabel,
  className = "",
}: {
  value?: string | null;
  emptyLabel: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm ${className}`.trim()}>
      {value?.trim() || emptyLabel}
    </div>
  );
}

function ReadOnlyList({
  values,
  emptyLabel,
}: {
  values: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
      {values.length ? values.join(", ") : emptyLabel}
    </div>
  );
}

function StratmapMultiSelect({
  value,
  onChange,
  stratmaps,
  dictionary,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  stratmaps: StratmapRecord[];
  dictionary: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(value);

  function toggle(stratmapId: string) {
    if (selectedIds.has(stratmapId)) {
      onChange(value.filter((id) => id !== stratmapId));
      return;
    }

    onChange([...value, stratmapId]);
  }

  const selectedLabels = stratmaps
    .filter((stratmap) => selectedIds.has(stratmap.id))
    .map((stratmap) => stratmap.title);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-auto min-h-11 w-full justify-between rounded-xl py-3">
          <span className="flex min-w-0 flex-1 flex-wrap gap-2 text-left">
            {selectedLabels.length ? (
              selectedLabels.map((label) => (
                <Badge key={label} variant="secondary" className="rounded-md">
                  {label}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{dictionary.shared.notSet}</span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder={dictionary.event.fields.stratmaps} />
          <CommandList>
            <CommandEmpty>{dictionary.shared.noMatchingResults}</CommandEmpty>
            <CommandGroup>
              {stratmaps.map((stratmap) => (
                <CommandItem
                  key={stratmap.id}
                  value={[stratmap.title, stratmap.baseMapId, stratmap.side, stratmap.strongpointId].filter(Boolean).join(" ")}
                  onSelect={() => toggle(stratmap.id)}
                >
                  <Check className={cn("mr-2 size-4", selectedIds.has(stratmap.id) ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{stratmap.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[stratmap.baseMapId, stratmap.side, stratmap.strongpointId].filter(Boolean).join(" • ")}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function EventFormPanel({
  event,
  serverId,
  locale,
  topicPresets,
  stratmaps,
  groups,
  eventCategories = [],
  timezone = "UTC",
  canEdit,
  dictionary,
  createMode = false,
  discordConfig,
}: {
  event: EventRecord;
  serverId: string;
  locale: string;
  topicPresets: TopicPreset[];
  stratmaps: StratmapRecord[];
  groups: Group[];
  eventCategories?: EventCategory[];
  timezone?: string;
  canEdit: boolean;
  dictionary: Dictionary;
  createMode?: boolean;
  discordConfig?: DiscordConfig | null;
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
      matchType: event.matchType ?? "",
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
      stratmapIds: event.stratmapIds ?? [],
      signupGroupIds: event.signupGroupIds ?? groups.map((group) => group.id),
      useGeneralSignup: event.useGeneralSignup ?? false,
    },
  });
  const eventKind = form.watch("kind");
  const detailBasePath = eventKind === "training" ? "trainings" : "matches";
  const eventName = form.watch("name");
  const eventCategoryValue = form.watch("matchType");
  const sideValue = form.watch("side");
  const mapValue = form.watch("map");
  const pingClan = form.watch("pingClan");
  const createForumChannel = form.watch("createForumChannel");
  const eventMatchValues = form.watch(["map", "side", "cap"]);
  const presetMatchValues = {
    map: eventMatchValues[0],
    side: eventMatchValues[1],
    cap: eventMatchValues[2],
  };
  const meetingChannels = metadata?.channels?.filter((channel) => channel.type === 2 || channel.type === 13) ?? [];
  const roleNameById = useMemo(
    () => new Map((metadata?.roles ?? []).map((role) => [role.id, role.name])),
    [metadata?.roles],
  );
  const channelNameById = useMemo(
    () => new Map(meetingChannels.map((channel) => [channel.id, channel.name])),
    [meetingChannels],
  );
  const presetMatchContext = useMemo<TopicPresetMatchContext>(
    () => ({
      mapCode: mapValue,
      mapId: selectedMapId || inferHllSelection(mapValue)?.mapId,
      time: selectedMapTime || inferHllSelection(mapValue)?.time,
      mode: selectedMapMode || inferHllSelection(mapValue)?.mode,
      side: sideValue,
      cap: presetMatchValues.cap,
    }),
    [mapValue, presetMatchValues.cap, selectedMapId, selectedMapMode, selectedMapTime, sideValue],
  );
  const topicPresetOptions = useMemo(
    () =>
      topicPresets
        .map((preset) => ({
          preset,
          match: getPresetMatch(preset, presetMatchContext),
        }))
        .sort((left, right) =>
          right.match.score - left.match.score ||
          right.match.label.length - left.match.label.length ||
          left.preset.name.localeCompare(right.preset.name),
        ),
    [presetMatchContext, topicPresets],
  );

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
    form.setValue("cap", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
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
      stratmapIds: values.stratmapIds,
      signupGroupIds: values.kind === "match" ? values.signupGroupIds : [],
      useGeneralSignup: values.kind === "match" ? values.useGeneralSignup : false,
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
      toast.error(body.error ?? dictionary.event.saveError);
      form.setError("root", {
        message: body.error ?? dictionary.event.saveError,
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
          {eventKind === "match" && pingClan && !discordConfig?.announcementsChannelId ? (
            <ConfigNotice
              title={dictionary.event.notices.announcementsTitle}
              href={canEdit ? `/${locale}/dashboard/servers/${serverId}/settings` : undefined}
              ctaLabel={canEdit ? dictionary.event.notices.openClanSettings : undefined}
            >
              {dictionary.event.notices.announcementsDescription}
            </ConfigNotice>
          ) : null}
          {eventKind === "match" && createForumChannel && !discordConfig?.forumCategoryId ? (
            <ConfigNotice
              title={dictionary.event.notices.forumTitle}
              href={canEdit ? `/${locale}/dashboard/servers/${serverId}/settings` : undefined}
              ctaLabel={canEdit ? dictionary.event.notices.openClanSettings : undefined}
            >
              {dictionary.event.notices.forumDescription}
            </ConfigNotice>
          ) : null}
          {!discordConfig?.meetingChannelId ? (
            <ConfigNotice
              tone="info"
              title={dictionary.event.notices.meetingAutomationTitle}
              href={canEdit ? `/${locale}/dashboard/servers/${serverId}/settings` : undefined}
              ctaLabel={canEdit ? dictionary.event.notices.openClanSettings : undefined}
            >
              {dictionary.event.notices.meetingAutomationDescription}
            </ConfigNotice>
          ) : null}
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
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(value) => field.onChange(value as EventInput["kind"])}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match">{dictionary.sidebar.matches}</SelectItem>
                        <SelectItem value="training">{dictionary.sidebar.trainings}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <ReadOnlyValue value={eventKind === "training" ? dictionary.sidebar.trainings : dictionary.sidebar.matches} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.name} required  />
              {canEdit ? <Input {...form.register("name")} className="rounded-xl" /> : <ReadOnlyValue value={form.watch("name")} emptyLabel={dictionary.shared.notSet} />}
              {form.formState.errors.name ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
            {eventKind === "match" ? (
              <div className="space-y-3 md:col-span-2">
                <FieldLabel label={dictionary.event.fields.map}  />
                {canEdit ? (
                  <HllMapSelector
                    mapId={selectedMapId}
                    onMapIdChange={(value) => {
                      handleMapSelection(value);
                      form.setValue("map", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                    }}
                    time={selectedMapTime}
                    onTimeChange={(value) => {
                      handleMapTimeSelection(value);
                      form.setValue("map", "", { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                    }}
                    mode={selectedMapMode}
                    onModeChange={handleMapModeSelection}
                    pointValue={form.watch("cap")}
                    onPointValueChange={(value) => form.setValue("cap", value, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                    includeVariants
                    labels={{
                      map: dictionary.event.fields.map,
                      mapSearch: dictionary.event.fields.map,
                      time: dictionary.event.fields.mapVariant,
                      mode: dictionary.event.fields.mapMode,
                      point: dictionary.event.fields.capMode,
                      pointSearch: dictionary.event.fields.capMode,
                      optional: dictionary.shared.notSet,
                      noResults: dictionary.shared.noMatchingResults,
                    }}
                  />
                ) : (
                  <ReadOnlyValue value={formatHllPresetLabel(mapValue) ?? mapValue} emptyLabel={dictionary.shared.notSet} />
                )}
                {mapValue ? (
                  <p className="text-xs text-muted-foreground">
                    {dictionary.event.fields.mapPresetCode}: <span className="font-mono">{mapValue}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            {eventKind === "match" ? (
            <div>
              <FieldLabel label={dictionary.event.fields.side}  />
              {canEdit ? <Input {...form.register("side")} className="rounded-xl" /> : <ReadOnlyValue value={form.watch("side")} emptyLabel={dictionary.shared.notSet} />}
            </div>
            ) : null}
            <div className="md:col-span-2">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {dictionary.serverSettings.timezone}: {supportedTimezones.includes(timezone as (typeof supportedTimezones)[number]) ? timezone : "UTC"}
              </div>
            </div>
            <div className="md:col-span-2">
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="thumbnailUrl"
                  render={({ field }) => (
                    <AvatarPicker
                      value={field.value || ""}
                      onChange={field.onChange}
                      fallback={eventName.slice(0, 2).toUpperCase() || "EV"}
                      label={dictionary.event.fields.thumbnail}
                      buttonLabel={dictionary.common.upload}
                      disabled={!canEdit || isPending}
                      className="rounded-2xl border border-border/60 p-4"
                    />
                  )}
                />
              ) : (
                <ReadOnlyValue value={form.watch("thumbnailUrl")} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.description}  />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <DiscordMarkdownTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      className="min-h-24 rounded-xl"
                      rows={6}
                    />
                  )}
                />
              ) : <DiscordMarkdownText markdown={form.watch("description")} emptyLabel={dictionary.shared.notSet} className="min-h-24 rounded-xl" />}
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.matchType}  />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="matchType"
                  render={({ field }) => (
                    <Select value={field.value || "__none"} onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={dictionary.shared.notSet} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{dictionary.shared.notSet}</SelectItem>
                        {eventCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <span className="inline-flex items-center gap-2">
                              <EmojiValue value={category.emoji} />
                              <span>{category.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                        {field.value && !eventCategories.some((category) => category.id === field.value) ? (
                          <SelectItem value={field.value}>{field.value}</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <ReadOnlyValue value={getEventCategoryLabel({ matchType: eventCategoryValue }, eventCategories)} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            {eventKind === "match" ? (
            <div className="md:col-span-2 md:grid md:grid-cols-3 md:gap-4">
              <div>
                <FieldLabel label={dictionary.event.fields.meetingChannelId}  />
                {canEdit ? (
                  <Controller
                    control={form.control}
                    name="meetingChannelId"
                    render={({ field }) => (
                      <DiscordEntitySelect
                        value={field.value || undefined}
                        onChange={(value) => field.onChange(value ?? "")}
                        options={meetingChannels}
                        placeholder={dictionary.event.fields.meetingChannelId}
                        noneLabel={dictionary.shared.notSet}
                      />
                    )}
                  />
                ) : (
                  <ReadOnlyValue
                    value={(() => {
                      const meetingChannelId = form.watch("meetingChannelId");
                      return meetingChannelId ? (channelNameById.get(meetingChannelId) ?? meetingChannelId) : undefined;
                    })()}
                    emptyLabel={dictionary.shared.notSet}
                  />
                )}
              </div>
              <div>
                <FieldLabel label={dictionary.event.fields.server}  />
                {canEdit ? <Input {...form.register("server")} autoComplete="one-time-code" className="rounded-xl" /> : <ReadOnlyValue value={form.watch("server")} emptyLabel={dictionary.shared.notSet} />}
              </div>
              <div>
                <FieldLabel label={dictionary.event.fields.serverPassword}  />
                {canEdit ? <Input {...form.register("serverPassword")} autoComplete={"new-password"} className="rounded-xl" /> : <ReadOnlyValue value={form.watch("serverPassword")} emptyLabel={dictionary.shared.notSet} />}
              </div>
            </div>
            ) : null}
            <div>
              <FieldLabel label={dictionary.event.fields.registrationEnd} required  />
              {canEdit ? <Input type="datetime-local" {...form.register("registrationEnd")} className="rounded-xl" /> : <ReadOnlyValue value={form.watch("registrationEnd")} emptyLabel={dictionary.shared.notSet} />}
              {form.formState.errors.registrationEnd ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.registrationEnd.message}</p> : null}
            </div>
            <div>
              <FieldLabel label={dictionary.event.fields.meetingStart} required  />
              {canEdit ? <Input type="datetime-local" {...form.register("meetingStart")} className="rounded-xl" /> : <ReadOnlyValue value={form.watch("meetingStart")} emptyLabel={dictionary.shared.notSet} />}
              {form.formState.errors.meetingStart ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.meetingStart.message}</p> : null}
            </div>
            {eventKind === "match" ? (
              <>
                <div>
                  <FieldLabel label={dictionary.event.fields.gameStart} required  />
                  {canEdit ? <Input type="datetime-local" {...form.register("gameStart")} className="rounded-xl" /> : <ReadOnlyValue value={form.watch("gameStart")} emptyLabel={dictionary.shared.notSet} />}
                  {form.formState.errors.gameStart ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.gameStart.message}</p> : null}
                </div>
                <div>
                  <FieldLabel label={dictionary.event.fields.gameEnd} required  />
                  {canEdit ? <Input type="datetime-local" {...form.register("gameEnd")} className="rounded-xl" /> : <ReadOnlyValue value={form.watch("gameEnd")} emptyLabel={dictionary.shared.notSet} />}
                  {form.formState.errors.gameEnd ? <p className="mt-2 text-sm text-destructive">{form.formState.errors.gameEnd.message}</p> : null}
                </div>
              </>
            ) : null}
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.topicPreset}  />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="topicPresetId"
                  render={({ field }) => (
                    <TopicPresetSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={topicPresetOptions}
                      dictionary={dictionary}
                    />
                  )}
                />
              ) : (
                <ReadOnlyValue value={topicPresets.find((preset) => preset.id === form.watch("topicPresetId"))?.name} emptyLabel={dictionary.event.noPreset} />
              )}
            </div>
            ) : null}
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.notes}  />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <DiscordMarkdownTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      className="min-h-28 rounded-xl"
                      rows={8}
                    />
                  )}
                />
              ) : <DiscordMarkdownText markdown={form.watch("notes")} emptyLabel={dictionary.shared.notSet} className="min-h-28 rounded-xl" />}
            </div>
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.stratmaps}  />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="stratmapIds"
                  render={({ field }) => (
                    <StratmapMultiSelect
                      value={field.value ?? []}
                      onChange={field.onChange}
                      stratmaps={stratmaps}
                      dictionary={dictionary}
                    />
                  )}
                />
              ) : (
                <ReadOnlyList values={(form.watch("stratmapIds") ?? []).map((id) => stratmaps.find((item) => item.id === id)?.title ?? id)} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            ) : null}
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              {canEdit ? (
                <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <FieldLabel label={dictionary.event.fields.useGeneralSignup} />
                    <p className="text-sm text-muted-foreground">{dictionary.event.generalSignupDescription}</p>
                  </div>
                  <Controller
                    control={form.control}
                    name="useGeneralSignup"
                    render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </div>
              ) : (
                <ReadOnlyValue value={form.watch("useGeneralSignup") ? dictionary.tables.enabled : dictionary.tables.disabled} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            ) : null}
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.signupGroupIds} />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="signupGroupIds"
                  render={({ field }) => {
                    const selectedIds = new Set(field.value ?? []);

                    return (
                      <div className="space-y-3 rounded-xl border border-border/60 p-4">
                        <p className="text-sm text-muted-foreground">{dictionary.event.signupGroupsDescription}</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {groups.map((group) => (
                            <label key={group.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2">
                              <Checkbox
                                checked={selectedIds.has(group.id)}
                                onCheckedChange={(checked) => {
                                  const nextValues = checked
                                    ? [...selectedIds, group.id]
                                    : [...selectedIds].filter((groupId) => groupId !== group.id);
                                  field.onChange(nextValues);
                                }}
                              />
                              <span className="size-3 rounded-full border border-border/60" style={{ backgroundColor: group.color }} />
                              <span className="text-sm">{group.name}</span>
                            </label>
                          ))}
                        </div>
                        {!groups.length ? <div className="text-sm text-muted-foreground">{dictionary.shared.nothingCreatedYet}</div> : null}
                      </div>
                    );
                  }}
                />
              ) : (
                <ReadOnlyList values={(form.watch("signupGroupIds") ?? []).map((id) => groups.find((group) => group.id === id)?.name ?? id)} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            ) : null}
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              {canEdit ? (
                <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <FieldLabel label={dictionary.event.fields.createForumChannel}  />
                    <p className="text-sm text-muted-foreground">
                      {dictionary.event.createForumChannelDescription}
                    </p>
                  </div>
                  <Controller
                    control={form.control}
                    name="createForumChannel"
                    render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </div>
              ) : (
                <ReadOnlyValue value={form.watch("createForumChannel") ? dictionary.tables.enabled : dictionary.tables.disabled} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            ) : null}
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.requiredRoleIds} />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="requiredRoleIds"
                  render={({ field }) => (
                    <DiscordMultiEntitySelect
                      value={field.value ?? []}
                      onChange={field.onChange}
                      options={metadata?.roles ?? []}
                      placeholder={dictionary.event.fields.requiredRoleIds}
                    />
                  )}
                />
              ) : (
                <ReadOnlyList values={(form.watch("requiredRoleIds") ?? []).map((id) => roleNameById.get(id) ?? id)} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            <div className="md:col-span-2">
              <FieldLabel label={dictionary.event.fields.rewardRoleIds} />
              {canEdit ? (
                <Controller
                  control={form.control}
                  name="rewardRoleIds"
                  render={({ field }) => (
                    <DiscordMultiEntitySelect
                      value={field.value ?? []}
                      onChange={field.onChange}
                      options={metadata?.roles ?? []}
                      placeholder={dictionary.event.fields.rewardRoleIds}
                    />
                  )}
                />
              ) : (
                <ReadOnlyList values={(form.watch("rewardRoleIds") ?? []).map((id) => roleNameById.get(id) ?? id)} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            {eventKind === "match" ? (
            <div className="md:col-span-2">
              {canEdit ? (
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
              ) : (
                <ReadOnlyValue value={form.watch("pingClan") ? dictionary.tables.enabled : dictionary.tables.disabled} emptyLabel={dictionary.shared.notSet} />
              )}
            </div>
            ) : null}
          </div>
          {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
          {canEdit ? (
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-xl" type="submit" disabled={!canEdit || isPending || form.formState.isSubmitting}>
                {dictionary.common.save}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
