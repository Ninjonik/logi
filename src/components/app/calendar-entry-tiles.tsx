import type { ReactNode } from "react"

import type { CalendarDisplayEntry } from "@/lib/calendar-entries"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import type { Dictionary } from "@/i18n/dictionaries"

/**
 * The facts shown for a calendar entry, shared by the highlighted cards and
 * the entry dialog: an event shows its meeting, game start, registration end
 * and map or meeting place; a manual item shows its start, end and category.
 */
export function getCalendarEntryTiles(
    entry: CalendarDisplayEntry,
    dictionary: Dictionary,
    formatInstant: (value: string) => string
): Array<{ key: string; label: string; value: ReactNode }> {
    const labels = dictionary.calendarPage
    if (entry.kind === "manual") {
        return [
            {
                key: "start",
                label: labels.start,
                value: entry.allDay
                    ? labels.allDay
                    : formatInstant(entry.startAt),
            },
            {
                key: "end",
                label: labels.end,
                value: entry.allDay
                    ? labels.allDay
                    : formatInstant(entry.endAt),
            },
            {
                key: "category",
                label: labels.category,
                value: entry.label ?? dictionary.shared.notSet,
            },
        ]
    }

    const event = entry.event
    const place =
        event.kind === "training"
            ? {
                  key: "place",
                  label: labels.meetingPlace,
                  value: event.meetingChannelId ? (
                      <a
                          href={`https://discord.com/channels/${event.guildId}/${event.meetingChannelId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-4"
                      >
                          {labels.openVoiceChannel}
                      </a>
                  ) : (
                      "Discord"
                  ),
              }
            : {
                  key: "map",
                  label: dictionary.calendarCards.map,
                  value: `${formatHllPresetLabel(event.map) ?? event.map ?? labels.toBeDecided} • ${event.side ?? labels.toBeDecided}`,
              }

    return [
        {
            key: "meeting",
            label: dictionary.calendarCards.meeting,
            value: formatInstant(event.meetingStart),
        },
        {
            key: "gameStart",
            label: dictionary.calendarCards.gameStart,
            value: formatInstant(event.gameStart),
        },
        {
            key: "registrationEnd",
            label: dictionary.calendarCards.registrationEnds,
            value: formatInstant(event.registrationEnd),
        },
        place,
    ]
}

export function InfoTile({
    label,
    value,
}: {
    label: string
    value: ReactNode
}) {
    return (
        <div className="border-border/60 min-w-0 rounded-xl border p-3">
            <div className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                {label}
            </div>
            <div className="mt-2 font-semibold break-words">{value}</div>
        </div>
    )
}
