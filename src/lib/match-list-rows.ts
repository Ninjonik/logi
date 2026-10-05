import {
    attendingCount,
    isPlayed,
    matchListPhase,
    matchListQueue,
    weekOffset,
    weekStartDate,
    type MatchPhase,
} from "@/domain/events/match-list"
import { DEFAULT_GAME_ID, GAME_LABELS, type GameId } from "@/domain/games/game"
import { describeRecurrence, formatListDate } from "@/lib/match-list-format"
import type { EventCategory, EventRecord, Roster } from "@/types/domain"
import { getEventCategoryLabel } from "@/lib/event-categories"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import type { Dictionary } from "@/i18n/dictionaries"

export type MatchBadgeTone = "info" | "attention" | "success" | "neutral"

/** One row of the match list, ready to render and filter in the browser. */
export type MatchListRow = {
    id: string
    href: string
    kind: "match" | "training"
    gameId: GameId
    played: boolean
    weekKey: number
    weekLabel: string
    date: string
    time: string
    title: string
    details: string
    metric: string
    metricStrong: boolean
    badge: { label: string; tone: MatchBadgeTone }
    search: string
}

export type MatchListQueueRow = {
    kind: "publishRoster" | "confirmAttendance"
    href: string
    title: string
    detail: string
}

function fill(template: string, values: Record<string, string | number>) {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        template
    )
}

function weekLabel(
    offset: number,
    weekStart: string,
    text: Dictionary["matchList"],
    locale: string
) {
    if (offset === 0) return text.weeks.thisWeek
    if (offset === 1) return text.weeks.nextWeek
    if (offset === -1) return text.weeks.lastWeek
    const { date } = formatListDate(weekStart, locale, "UTC")
    return fill(text.weeks.weekOf, { date })
}

function phaseBadge(
    phase: MatchPhase,
    text: Dictionary["matchList"],
    dictionary: Dictionary,
    locale: string,
    timeZone: string
): MatchListRow["badge"] {
    switch (phase.kind) {
        case "registration": {
            const closes = formatListDate(phase.closesAt, locale, timeZone)
            return {
                label: fill(text.phase.registration, {
                    when: `${closes.date} ${closes.time}`,
                }),
                tone: "info",
            }
        }
        case "registrationClosed":
            return { label: text.phase.registrationClosed, tone: "neutral" }
        case "rosterMissing":
            return { label: text.phase.rosterMissing, tone: "attention" }
        case "rosterDraft":
            return { label: text.phase.rosterDraft, tone: "attention" }
        case "rosterPublished":
            return phase.unconfirmed > 0
                ? {
                      label: fill(text.phase.unconfirmed, {
                          count: phase.unconfirmed,
                      }),
                      tone: "attention",
                  }
                : { label: text.phase.rosterPublished, tone: "success" }
        case "awaitingResult":
            return { label: text.phase.awaitingResult, tone: "attention" }
        case "result":
            return {
                label:
                    phase.outcome === "victory"
                        ? dictionary.event.resultVictory
                        : phase.outcome === "defeat"
                          ? dictionary.event.resultDefeat
                          : dictionary.event.resultDraw,
                tone: phase.outcome === "victory" ? "success" : "neutral",
            }
        case "trainingCompleted":
        case "concluded":
            return { label: text.phase.concluded, tone: "success" }
    }
}

function phaseMetric(
    phase: MatchPhase,
    signedUp: number,
    text: Dictionary["matchList"]
): { metric: string; strong: boolean } {
    if (phase.kind === "result")
        return {
            metric: `${phase.score.sideA} : ${phase.score.sideB}`,
            strong: true,
        }
    if (phase.kind === "trainingCompleted")
        return {
            metric: fill(text.trainingOutcome, {
                passed: phase.passed,
                failed: phase.failed,
            }),
            strong: false,
        }
    return { metric: fill(text.signedUp, { count: signedUp }), strong: false }
}

/** Rows and organiser tasks of the match list for one clan. */
export function buildMatchListRows(input: {
    events: EventRecord[]
    rosters: Roster[]
    categories: EventCategory[] | undefined
    canAdmin: boolean
    locale: string
    serverId: string
    timeZone: string
    dictionary: Dictionary
    now: Date
}) {
    const { dictionary, locale, timeZone, now } = input
    const text = dictionary.matchList
    const base = `/${input.locale}/dashboard/servers/${input.serverId}`
    const rosterByEvent = new Map(
        input.rosters.map((roster) => [roster.eventId, roster])
    )
    const eventById = new Map(input.events.map((event) => [event.id, event]))
    const hrefFor = (event: EventRecord) =>
        `${base}/${event.kind === "training" ? "trainings" : "matches"}/${event.id}`
    const startOf = (event: EventRecord) =>
        event.kind === "training" ? event.meetingStart : event.gameStart

    const rows: MatchListRow[] = input.events.map((event) => {
        const gameId = event.gameId ?? DEFAULT_GAME_ID
        const roster = rosterByEvent.get(event.id)
        const phase = matchListPhase(event, roster, now)
        const signedUp = attendingCount(event)
        const start = startOf(event)
        const offset = weekOffset(start, now, timeZone)
        const { date, time } = formatListDate(start, locale, timeZone)
        const category = getEventCategoryLabel(event, input.categories)
        const details =
            event.kind === "training"
                ? [
                      dictionary.matchTemplates.basics.training,
                      event.recurrence
                          ? describeRecurrence(
                                event.recurrence,
                                dictionary,
                                locale
                            )
                          : undefined,
                  ]
                : [
                      GAME_LABELS[gameId],
                      event.map
                          ? (formatHllPresetLabel(event.map, event.gameId) ??
                            event.map)
                          : undefined,
                      event.side || undefined,
                  ]
        const metric = phaseMetric(phase, signedUp, text)
        const title = [event.name, category].filter(Boolean).join(" · ")
        const detailText = details.filter(Boolean).join(" · ")
        return {
            id: event.id,
            href: hrefFor(event),
            kind: event.kind,
            gameId,
            played: isPlayed(event, now),
            weekKey: offset,
            weekLabel: weekLabel(
                offset,
                weekStartDate(start, timeZone),
                text,
                locale
            ),
            date,
            time,
            title,
            details: detailText,
            metric: metric.metric,
            metricStrong: metric.strong,
            badge: phaseBadge(phase, text, dictionary, locale, timeZone),
            search: `${title} ${detailText}`.toLocaleLowerCase(),
        }
    })
    const startById = new Map(
        input.events.map((event) => [event.id, Date.parse(startOf(event))])
    )
    rows.sort(
        (left, right) =>
            (startById.get(left.id) ?? 0) - (startById.get(right.id) ?? 0)
    )

    const queue: MatchListQueueRow[] = input.canAdmin
        ? matchListQueue(input.events, input.rosters, now).flatMap((item) => {
              const event = eventById.get(item.eventId)
              if (!event) return []
              const when = formatListDate(item.gameStart, locale, timeZone)
              const whenText = `${when.date} ${when.time}`
              return [
                  item.kind === "publishRoster"
                      ? {
                            kind: item.kind,
                            href: rosterByEvent.has(event.id)
                                ? `${base}/rosters/${rosterByEvent.get(event.id)?.id}`
                                : hrefFor(event),
                            title: text.queue.publishRoster,
                            detail: [
                                event.name,
                                whenText,
                                item.openSlots
                                    ? fill(text.queue.openSlots, {
                                          count: item.openSlots,
                                      })
                                    : fill(text.signedUp, {
                                          count: item.signedUp,
                                      }),
                            ].join(" · "),
                        }
                      : {
                            kind: item.kind,
                            href: hrefFor(event),
                            title: text.queue.confirmAttendance,
                            detail: [
                                event.name,
                                whenText,
                                fill(text.queue.unconfirmed, {
                                    count: item.unconfirmed,
                                }),
                            ].join(" · "),
                        },
              ]
          })
        : []

    return { rows, queue }
}
