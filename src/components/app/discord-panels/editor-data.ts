import type { CalendarEntry } from "@/domain/discord-publications/calendar-panel"
import type { ResultCardEvent } from "@/domain/discord-publications/result-panel"
import { buildResultCardFacts } from "@/domain/discord-publications/result-card"
import type { EventCategory, EventRecord } from "@/types/domain"

/**
 * Data the editor previews of the calendar and results panels are drawn
 * from (P2-B09): the clan's own events, mapped once on the server page.
 */

const CALENDAR_DAYS = 31
const DAY_MS = 24 * 60 * 60 * 1000

/** Upcoming published events as calendar rows; the bot adds the announcement links. */
export function calendarPreviewEntries(input: {
    events: readonly EventRecord[]
    categories: readonly EventCategory[]
    now: number
    trainingWord: string
}): CalendarEntry[] {
    const until = input.now + CALENDAR_DAYS * DAY_MS
    return input.events
        .filter(
            (event) =>
                !event.isDraft &&
                Date.parse(event.gameEnd) >= input.now &&
                Date.parse(event.gameStart) <= until
        )
        .slice(0, 50)
        .map((event) => ({
            id: event.id,
            title: event.name,
            typeWord:
                event.kind === "training"
                    ? input.trainingWord
                    : (input.categories.find(
                          (category) => category.id === event.matchType
                      )?.label ?? null),
            startAt: event.gameStart,
            endAt: event.gameEnd,
            allDay: false,
            url: null,
            signupUntil: event.registrationEnd ?? null,
            category: event.matchType ?? null,
            event: true,
            range: event.kind === "training",
        }))
}

/** The last match with a result per game, as a results card would show it. */
export function latestResultEvents(input: {
    events: readonly EventRecord[]
    categories: readonly EventCategory[]
    guildDiscordId: string
}): Partial<
    Record<
        "hell_let_loose" | "wardogs",
        ResultCardEvent & { mapLabel: string | null }
    >
> {
    const latest: Partial<
        Record<
            "hell_let_loose" | "wardogs",
            ResultCardEvent & { mapLabel: string | null }
        >
    > = {}
    const withResult = input.events
        .filter((event) => event.eventResult && !event.isDraft)
        .sort((a, b) => b.gameEnd.localeCompare(a.gameEnd))
    for (const event of withResult) {
        const game = event.gameId === "wardogs" ? "wardogs" : "hell_let_loose"
        if (latest[game] || !event.eventResult) continue
        const result = event.eventResult
        latest[game] = {
            id: event.id,
            name: event.name,
            result: {
                status: "confirmed",
                version: 1,
                reviewedAt: null,
                participants: [
                    { label: result.sideA, score: result.score.sideA },
                    { label: result.sideB, score: result.score.sideB },
                ],
            },
            card: buildResultCardFacts({
                event: {
                    matchType: event.matchType,
                    side: event.side,
                    eventResult: {
                        outcome: result.outcome,
                        score: result.score,
                    },
                },
                categories: input.categories,
                guildDiscordId: input.guildDiscordId,
                publicMatch: false,
            }),
            matchUrl: null,
            mapLabel: result.mapName ?? event.map ?? null,
        }
    }
    return latest
}
