"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/app/avatar-picker";
import type { DiscordSelectOption } from "@/components/app/discord-entity-select";
import { EmojiPickerInput } from "@/components/app/emoji-picker-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { CalendarItem, EventCategory, Guild } from "@/types/domain";

type EditableEventCategory = EventCategory & { id: string; emoji: string };
type EditableCalendarItem = {
  id: string;
  title: string;
  description: string;
  color: string;
  emoji: string;
  label: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  recurrenceFrequency: "none" | "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly";
  recurrenceInterval: string;
  recurrenceUntil: string;
};
type DiscordMetadata = { emojis: DiscordSelectOption[] };

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildDefaultCategory(): EditableEventCategory {
  return {
    id: makeId("event-category"),
    label: "",
    color: "#6b7280",
    emoji: "",
  };
}

function buildDefaultCalendarItem(): EditableCalendarItem {
  return {
    id: makeId("calendar-item"),
    title: "",
    description: "",
    color: "#7c3aed",
    emoji: "",
    label: "",
    startDate: "2026-08-02",
    endDate: "2026-08-02",
    startTime: "19:00",
    endTime: "20:00",
    allDay: false,
    recurrenceFrequency: "none",
    recurrenceInterval: "1",
    recurrenceUntil: "",
  };
}

function toEditableCategories(categories: Guild["eventCategories"]): EditableEventCategory[] {
  return (categories ?? []).map((category) => ({
    ...category,
    emoji: category.emoji ?? "",
  }));
}

function toEditableCalendarItems(items: Guild["calendarItems"]): EditableCalendarItem[] {
  return (items ?? []).map((item) => {
    const startAt = new Date(item.startAt);
    const endAt = new Date(item.endAt);
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      color: item.color,
      emoji: item.emoji ?? "",
      label: item.label ?? "",
      startDate: startAt.toISOString().slice(0, 10),
      endDate: endAt.toISOString().slice(0, 10),
      startTime: startAt.toISOString().slice(11, 16),
      endTime: endAt.toISOString().slice(11, 16),
      allDay: item.allDay,
      recurrenceFrequency: item.recurrence?.frequency ?? "none",
      recurrenceInterval: String(item.recurrence?.interval ?? 1),
      recurrenceUntil: item.recurrence?.until?.slice(0, 10) ?? "",
    };
  });
}

function combineDateAndTime(date: string, time: string, allDay: boolean, endOfDay = false) {
  if (allDay) {
    return new Date(`${date}T${endOfDay ? "23:59" : "00:00"}:00`).toISOString();
  }
  return new Date(`${date}T${time || (endOfDay ? "23:59" : "00:00")}:00`).toISOString();
}

function toPersistedCalendarItems(items: EditableCalendarItem[]): CalendarItem[] {
  return items.map((item) => ({
    id: item.id,
    guildId: "",
    title: item.title,
    description: item.description || undefined,
    color: item.color,
    emoji: item.emoji || undefined,
    label: item.label || undefined,
    startAt: combineDateAndTime(item.startDate, item.startTime, item.allDay, false),
    endAt: combineDateAndTime(item.endDate, item.endTime, item.allDay, true),
    allDay: item.allDay,
    recurrence: item.recurrenceFrequency === "none" ? undefined : {
      frequency: item.recurrenceFrequency,
      interval: Math.max(1, Number.parseInt(item.recurrenceInterval || "1", 10)),
      until: item.recurrenceUntil ? combineDateAndTime(item.recurrenceUntil, "23:59", true, true) : undefined,
    },
    createdAt: "",
    updatedAt: "",
  }));
}

export function ServerFrontendSettingsForm({
  server,
  dictionary,
  guildLoginUrl,
}: {
  server: Guild;
  dictionary: Dictionary;
  guildLoginUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(server.name);
  const [avatar, setAvatar] = useState(server.avatar);
  const [description, setDescription] = useState(server.description ?? "");
  const [eventCategories, setEventCategories] = useState<EditableEventCategory[]>(toEditableCategories(server.eventCategories));
  const [calendarItems, setCalendarItems] = useState<EditableCalendarItem[]>(toEditableCalendarItems(server.calendarItems));
  const [metadata, setMetadata] = useState<DiscordMetadata | null>(null);

  useEffect(() => {
    fetch(`/api/servers/${server.id}/discord-metadata`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body || !Array.isArray(body.emojis)) {
          throw new Error("Unable to load Discord metadata.");
        }
        setMetadata({ emojis: body.emojis });
      })
      .catch(() => setMetadata(null));
  }, [server.id]);

  function patchCategory(categoryId: string, patch: Partial<EditableEventCategory>) {
    setEventCategories((current) => current.map((category) => (
      category.id === categoryId ? { ...category, ...patch } : category
    )));
  }

  function patchCalendarItem(itemId: string, patch: Partial<EditableCalendarItem>) {
    setCalendarItems((current) => current.map((item) => (
      item.id === itemId ? { ...item, ...patch } : item
    )));
  }

  async function handleSave() {
    const response = await fetch(`/api/servers/${server.id}/frontend-settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        avatar,
        description,
        eventCategories: eventCategories.map((category) => ({
          id: category.id,
          label: category.label,
          color: category.color,
          emoji: category.emoji || undefined,
        })),
        calendarItems: toPersistedCalendarItems(calendarItems).map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          color: item.color,
          emoji: item.emoji,
          label: item.label,
          startAt: item.startAt,
          endAt: item.endAt,
          allDay: item.allDay,
          recurrence: item.recurrence,
        })),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.error ?? dictionary.common.error);
      return;
    }

    toast.success(dictionary.common.save);
    startTransition(() => router.refresh());
  }

  async function handleCopyLoginUrl() {
    await navigator.clipboard.writeText(guildLoginUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.serverSettings.clanName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{dictionary.serverSettings.clanName}</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <AvatarPicker value={avatar} onChange={setAvatar} fallback={name.slice(0, 2) || "CL"} label={dictionary.userSettings.avatar} buttonLabel={dictionary.common.upload} disabled={isPending} />
        </div>
        <div className="space-y-2">
          <Label>{dictionary.event.fields.description}</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-28 rounded-xl" />
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{dictionary.serverSettings.eventCategoriesTitle}</h3>
              <p className="text-sm text-muted-foreground">{dictionary.serverSettings.eventCategoriesDescription}</p>
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEventCategories((current) => [...current, buildDefaultCategory()])}>
              <Plus className="mr-2 size-4" />
              {dictionary.serverSettings.addEventCategory}
            </Button>
          </div>

          {eventCategories.length ? eventCategories.map((category, index) => (
            <div key={category.id} className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-medium">{dictionary.serverSettings.eventCategoryLabel} {index + 1}</h4>
                  <p className="text-xs text-muted-foreground">ID: {category.id}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => setEventCategories((current) => current.filter((item) => item.id !== category.id))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.eventCategoryName}</Label>
                  <Input value={category.label} onChange={(event) => patchCategory(category.id, { label: event.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.ticketSettings.emoji}</Label>
                  <EmojiPickerInput value={category.emoji} onChange={(value) => patchCategory(category.id, { emoji: value ?? "" })} customEmojis={metadata?.emojis ?? []} placeholder={dictionary.emojiPicker.pickEmoji} labels={dictionary.emojiPicker} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{dictionary.groups.color}</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={category.color} onChange={(event) => patchCategory(category.id, { color: event.target.value })} className="h-11 w-16 rounded-xl p-1" />
                  <Input value={category.color} onChange={(event) => patchCategory(category.id, { color: event.target.value })} className="rounded-xl" />
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">{dictionary.serverSettings.noEventCategories}</div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{dictionary.serverSettings.calendarItemsTitle}</h3>
              <p className="text-sm text-muted-foreground">{dictionary.serverSettings.calendarItemsDescription}</p>
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCalendarItems((current) => [...current, buildDefaultCalendarItem()])}>
              <Plus className="mr-2 size-4" />
              {dictionary.serverSettings.addCalendarItem}
            </Button>
          </div>

          {calendarItems.length ? calendarItems.map((item, index) => (
            <div key={item.id} className="space-y-4 rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <h4 className="font-medium">{dictionary.serverSettings.calendarItemLabel} {index + 1}</h4>
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => setCalendarItems((current) => current.filter((entry) => entry.id !== item.id))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.calendarItemTitle}</Label>
                  <Input value={item.title} onChange={(event) => patchCalendarItem(item.id, { title: event.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.calendarItemLabelName}</Label>
                  <Input value={item.label} onChange={(event) => patchCalendarItem(item.id, { label: event.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{dictionary.event.fields.description}</Label>
                  <Textarea value={item.description} onChange={(event) => patchCalendarItem(item.id, { description: event.target.value })} className="min-h-24 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.ticketSettings.emoji}</Label>
                  <EmojiPickerInput value={item.emoji} onChange={(value) => patchCalendarItem(item.id, { emoji: value ?? "" })} customEmojis={metadata?.emojis ?? []} placeholder={dictionary.emojiPicker.pickEmoji} labels={dictionary.emojiPicker} />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.groups.color}</Label>
                  <div className="flex items-center gap-3">
                    <Input type="color" value={item.color} onChange={(event) => patchCalendarItem(item.id, { color: event.target.value })} className="h-11 w-16 rounded-xl p-1" />
                    <Input value={item.color} onChange={(event) => patchCalendarItem(item.id, { color: event.target.value })} className="rounded-xl" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.allDay} onChange={(event) => patchCalendarItem(item.id, { allDay: event.target.checked })} />
                <span>{dictionary.serverSettings.calendarItemAllDay}</span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.calendarItemStart}</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input type="date" value={item.startDate} onChange={(event) => patchCalendarItem(item.id, { startDate: event.target.value })} className="rounded-xl" />
                    {!item.allDay ? <Input type="time" value={item.startTime} onChange={(event) => patchCalendarItem(item.id, { startTime: event.target.value })} className="rounded-xl" /> : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.calendarItemEnd}</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input type="date" value={item.endDate} onChange={(event) => patchCalendarItem(item.id, { endDate: event.target.value })} className="rounded-xl" />
                    {!item.allDay ? <Input type="time" value={item.endTime} onChange={(event) => patchCalendarItem(item.id, { endTime: event.target.value })} className="rounded-xl" /> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.calendarItemRecurrence}</Label>
                  <Select value={item.recurrenceFrequency} onValueChange={(value) => patchCalendarItem(item.id, { recurrenceFrequency: value as EditableCalendarItem["recurrenceFrequency"] })}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{dictionary.serverSettings.recurrenceNone}</SelectItem>
                      <SelectItem value="weekly">{dictionary.serverSettings.recurrenceWeekly}</SelectItem>
                      <SelectItem value="monthly_date">{dictionary.serverSettings.recurrenceMonthlyDate}</SelectItem>
                      <SelectItem value="monthly_nth_weekday">{dictionary.serverSettings.recurrenceMonthlyNthWeekday}</SelectItem>
                      <SelectItem value="yearly">{dictionary.serverSettings.recurrenceYearly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.calendarItemRecurrenceInterval}</Label>
                  <Input type="number" min="1" value={item.recurrenceInterval} onChange={(event) => patchCalendarItem(item.id, { recurrenceInterval: event.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>{dictionary.serverSettings.calendarItemRecurrenceUntil}</Label>
                  <Input type="date" value={item.recurrenceUntil} onChange={(event) => patchCalendarItem(item.id, { recurrenceUntil: event.target.value })} className="rounded-xl" disabled={item.recurrenceFrequency === "none"} />
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-sm text-muted-foreground">{dictionary.serverSettings.noCalendarItems}</div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{dictionary.serverSettings.guildLoginUrl}</Label>
          <div className="flex gap-2">
            <Input value={guildLoginUrl} readOnly disabled className="rounded-xl disabled:cursor-text disabled:opacity-100" />
            <Button type="button" variant="outline" className="shrink-0 rounded-xl" onClick={handleCopyLoginUrl}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? dictionary.serverSettings.copiedLoginUrl : dictionary.serverSettings.copyLoginUrl}
            </Button>
          </div>
        </div>
        <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
          {dictionary.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}
