import { panelFactionOf } from "./panel-presentation"

/**
 * A Logi match running on a server (P4-23, P4-28, L3-35, L3-B10): the match
 * line "VLK vs ROG · Přátelák · probíhá od 20:00" and the team codes beside
 * the sides. A match "runs on the server" when it is between its start and
 * end and its server field names that server (its Logi name, provider name
 * or address). Nothing is guessed: no match, no line.
 */
export type RunningMatchEvent = {
    id: string
    name: string
    gameId: string | null
    isDraft: boolean
    server: string | null
    gameStart: string
    gameEnd: string
    matchType: string | null
    side: string | null
    teams: Array<{ slot: string; side: string | null; code: string | null }>
}

export type RunningMatch = {
    eventId: string
    title: string
    category: string | null
    startedAt: number
    allies: string | null
    axis: string | null
}

/** A match counts as running from 15 minutes before its start (warm-up) to its end. */
export const RUNNING_MATCH_LEAD_MS = 15 * 60_000

const compact = (value: string) =>
    value
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9.:]/g, "")

/**
 * Whether an event's free-text server names this server: its address, or
 * one of its names in full or before " · " ("Vlci #1" for "Vlci #1 ·
 * Public"). Exact after normalising, so "Vlci #1" never matches "Vlci #10".
 */
export function eventNamesServer(
    eventServer: string | null,
    server: { names: Array<string | null>; address: string | null }
) {
    const text = eventServer?.trim()
    if (!text) return false
    const wanted = compact(text)
    if (!wanted) return false
    if (server.address && compact(server.address) === wanted) return true
    return server.names.some((name) => {
        if (!name?.trim()) return false
        const head = name.split(/\s+[·|–-]\s+/)[0] ?? name
        return [name, head].some((candidate) => {
            const value = compact(candidate)
            return value.length >= 3 && value === wanted
        })
    })
}

export function runningMatchFor(
    events: readonly RunningMatchEvent[],
    input: {
        gameId: string
        names: Array<string | null>
        address: string | null
        now: number
        /** Category labels by ID ("friendly" → "Přátelák"). */
        categoryLabel: (id: string) => string | null
    }
): RunningMatch | null {
    const running = events
        .filter(
            (event) =>
                !event.isDraft &&
                (event.gameId ?? "hell_let_loose") === input.gameId &&
                Date.parse(event.gameStart) - RUNNING_MATCH_LEAD_MS <=
                    input.now &&
                input.now <= Date.parse(event.gameEnd) &&
                eventNamesServer(event.server, input)
        )
        .sort((a, b) => Date.parse(b.gameStart) - Date.parse(a.gameStart))
    const event = running[0]
    if (!event) return null
    const ordered = event.teams
        .slice()
        .sort((a, b) => a.slot.localeCompare(b.slot))
    const codes = ordered
        .map((team) => team.code?.trim())
        .filter((code): code is string => Boolean(code))
    const bySide = (side: "allies" | "axis") =>
        ordered.find((team) => panelFactionOf(team.side) === side)?.code ?? null
    return {
        eventId: event.id,
        title: codes.length >= 2 ? codes.join(" vs ") : event.name,
        category: event.matchType
            ? (input.categoryLabel(event.matchType) ?? event.matchType)
            : null,
        startedAt: Date.parse(event.gameStart),
        allies: bySide("allies"),
        axis: bySide("axis"),
    }
}

/**
 * "Z klanu hraje" (P4-25): the live players whose platform ID belongs to a
 * member of the clan through a verified Steam link. Names come from the
 * server; the order is the live list's.
 */
export function clanPlayersOnServer(
    roster: ReadonlyArray<{ id: string | null; name: string }>,
    memberPlatformIds: ReadonlySet<string>
): string[] {
    const seen = new Set<string>()
    return roster.flatMap((player) => {
        if (!player.id || !memberPlatformIds.has(player.id)) return []
        if (seen.has(player.id)) return []
        seen.add(player.id)
        return [player.name]
    })
}
