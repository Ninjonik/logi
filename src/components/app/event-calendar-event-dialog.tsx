"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { EmojiValue } from "@/components/app/emoji-value";
import { EventSignupActions } from "@/components/app/event-signup-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getEventCategoryPresentation } from "@/lib/event-categories";
import { formatDateTime } from "@/lib/format";
import { formatHllPresetLabel } from "@/lib/hll-map-presets";
import type { EventCategory, EventRecord, Group } from "@/types/domain";

export function EventCalendarEventDialog({
  trigger,
  locale,
  serverId,
  event,
  groups,
  eventCategories = [],
  timezone,
  dictionary,
  signupLanguage,
}: {
  trigger: ReactNode;
  locale: Locale;
  serverId: string;
  event: EventRecord;
  groups: Group[];
  eventCategories?: EventCategory[];
  timezone?: string;
  dictionary: Dictionary;
  signupLanguage: "en" | "cs";
}) {
  const category = getEventCategoryPresentation(event, eventCategories);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader className="pr-12">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              {category.label ? (
                <div
                  className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                  style={{ borderColor: `${category.color}66`, backgroundColor: `${category.color}14`, color: category.color }}
                >
                  <EmojiValue value={category.emoji} />
                  <span>{category.label}</span>
                </div>
              ) : null}
              <DialogTitle>{event.name}</DialogTitle>
              <DialogDescription>{event.description || dictionary.event.listDescription}</DialogDescription>
            </div>
            <Button asChild className="rounded-xl">
              <Link href={`/${locale}/dashboard/servers/${serverId}/${event.kind === "training" ? "trainings" : "matches"}/${event.id}`}>
                {dictionary.common.viewDetails}
              </Link>
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile label={dictionary.calendarCards.meeting} value={formatDateTime(event.meetingStart, timezone)} />
          <InfoTile label={dictionary.calendarCards.registrationEnds} value={formatDateTime(event.registrationEnd, timezone)} />
          <InfoTile label={dictionary.calendarCards.gameStart} value={formatDateTime(event.gameStart, timezone)} />
          <InfoTile
            label={dictionary.calendarCards.map}
            value={event.kind === "training"
              ? (event.meetingChannelId || "Discord")
              : `${formatHllPresetLabel(event.map) ?? event.map ?? "TBD"} • ${event.side ?? "TBD"}`}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">{dictionary.common.actions}</div>
          <EventSignupActions
            serverId={serverId}
            event={event}
            groups={groups}
            signupLanguage={signupLanguage}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-semibold">{value}</div>
    </div>
  );
}
