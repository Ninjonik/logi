import type { PanelDeliveryState } from "./panel-delivery"
import type { PanelKind } from "./settings"

/**
 * The list of "Panely v Discordu" (board P1): which group a panel belongs
 * to, the buttons of its row, what its timing line says and the summary
 * chips. Pure: the page passes the overview read model and the clock; the
 * words come from the dashboard dictionary.
 */

/** Groups in board order (P1-12..22, P1-B08); competitions follow the calendar. */
export const PANEL_LIST_GROUPS = [
    "live",
    "combined",
    "control",
    "results",
    "league",
    "calendar",
    "competition",
] as const
export type PanelListGroup = (typeof PANEL_LIST_GROUPS)[number]

export function panelListGroup(kind: PanelKind): PanelListGroup {
    switch (kind) {
        case "server":
            return "live"
        case "servers":
            return "combined"
        case "results":
            return "results"
        case "league":
            return "league"
        case "calendar":
            return "calendar"
        case "competition":
            return "competition"
    }
}

/**
 * A row is a panel, one of the two WD League messages, a seed control
 * message, or the calendar posted to the channel saved before panels
 * existed ("calendar-setting", N1-47) until "Upravit" turns it into a panel.
 */
export type PanelRowSource =
    | "panel"
    | "league-table"
    | "league-fixtures"
    | "control"
    | "calendar-setting"

export type PanelRowButton =
    /** "Upravit" → editor (or the seed page for a control message). */
    | "edit"
    /** "Obnovit teď". */
    | "refresh"
    /** "Pozastavit". */
    | "pause"
    /** "Pokračovat". */
    | "resume"
    /** "Odeslat do kanálu", the row's primary button. */
    | "publish"

export type PanelRowActions = {
    buttons: PanelRowButton[]
    /** The error box under the row with "Opravit" and "Zkusit znovu" (P1-16). */
    errorBox: boolean
}

/**
 * Buttons of one row (P1-13..22, P1-B04): a published panel can be refreshed
 * and paused; results are event driven, so they have no "Obnovit teď"; a
 * waiting panel can still be paused; an unsent one is sent; a paused one
 * continues. A failing panel shows its error box with the fix and retry.
 */
export function panelRowActions(input: {
    source: PanelRowSource
    kind: PanelKind | null
    state: PanelDeliveryState
}): PanelRowActions {
    if (input.source === "control")
        return { buttons: ["edit", "refresh"], errorBox: false }
    if (input.source === "calendar-setting")
        return { buttons: ["edit"], errorBox: false }
    switch (input.state) {
        case "unsent":
            return { buttons: ["edit", "publish"], errorBox: false }
        case "paused":
            return { buttons: ["edit", "resume"], errorBox: false }
        case "waiting":
            return { buttons: ["edit", "pause"], errorBox: false }
        case "error":
            return { buttons: ["edit", "pause"], errorBox: true }
        case "published":
            return input.kind === "results"
                ? { buttons: ["edit", "pause"], errorBox: false }
                : { buttons: ["edit", "refresh", "pause"], errorBox: false }
    }
}

/** One piece of a row's timing line; the page puts the words around it. */
export type PanelTimingPart =
    | { kind: "updated"; at: number }
    | { kind: "nextRefresh"; at: number }
    | { kind: "lastAttempt"; at: number }
    | { kind: "nextRetry"; at: number }
    | { kind: "notInDiscord" }
    | { kind: "requested"; at: number }
    | { kind: "pickup" }
    | { kind: "firstPass" }
    | { kind: "saved"; at: number }
    | { kind: "notSentYet" }
    | { kind: "pausedBy"; by: string | null; at: number | null }
    | { kind: "pausedKeeps" }
    | { kind: "lastResult"; at: number }
    | { kind: "noResultYet" }
    | { kind: "resultsInChannel"; count: number }
    | { kind: "resultsBackfill" }
    | { kind: "controlButtons" }
    | { kind: "calendarSetting" }
    | { kind: "open" }

export type PanelTimingInput = {
    source: PanelRowSource
    kind: PanelKind | null
    state: PanelDeliveryState
    now: number
    savedAt: number | null
    requestedAt: number | null
    lastUpdateAt: number | null
    lastAttemptAt: number | null
    nextUpdateAt: number | null
    pausedAt: number | null
    pausedBy: string | null
    /** Messages the panel owns in Discord (results: cards in the channel). */
    messages: number
    /** "Otevřít zprávu" can link the panel's message. */
    hasMessage: boolean
}

/**
 * The timing line of a row (P1-B02): last update or last attempt, the next
 * refresh or retry, when an unsent panel was saved and who paused a panel.
 * A time already past reads as "now" rather than as a negative countdown.
 */
export function panelTimingParts(input: PanelTimingInput): PanelTimingPart[] {
    const parts: PanelTimingPart[] = []
    const open = () => {
        if (input.hasMessage) parts.push({ kind: "open" })
    }
    const next = (kind: "nextRefresh" | "nextRetry") => {
        if (input.nextUpdateAt !== null)
            parts.push({ kind, at: Math.max(input.nextUpdateAt, input.now) })
    }
    if (input.source === "control") {
        if (input.lastUpdateAt !== null)
            parts.push({ kind: "updated", at: input.lastUpdateAt })
        else if (input.state === "waiting") parts.push({ kind: "pickup" })
        parts.push({ kind: "controlButtons" })
        open()
        return parts
    }
    if (input.source === "calendar-setting") {
        if (input.lastUpdateAt !== null)
            parts.push({ kind: "updated", at: input.lastUpdateAt })
        parts.push({ kind: "calendarSetting" })
        open()
        return parts
    }
    switch (input.state) {
        case "unsent":
            if (input.savedAt !== null)
                parts.push({ kind: "saved", at: input.savedAt })
            parts.push({ kind: "notSentYet" })
            return parts
        case "paused":
            parts.push({
                kind: "pausedBy",
                by: input.pausedBy,
                at: input.pausedAt,
            })
            parts.push({ kind: "pausedKeeps" })
            open()
            return parts
        case "waiting":
            if (input.requestedAt !== null) {
                parts.push({ kind: "requested", at: input.requestedAt })
                parts.push({ kind: "pickup" })
            } else parts.push({ kind: "firstPass" })
            return parts
        case "error":
            if (input.lastAttemptAt !== null)
                parts.push({ kind: "lastAttempt", at: input.lastAttemptAt })
            next("nextRetry")
            if (input.hasMessage) open()
            else parts.push({ kind: "notInDiscord" })
            return parts
        case "published":
            if (input.kind === "results") {
                if (input.lastUpdateAt !== null)
                    parts.push({ kind: "lastResult", at: input.lastUpdateAt })
                else parts.push({ kind: "noResultYet" })
                parts.push({ kind: "resultsInChannel", count: input.messages })
                parts.push({ kind: "resultsBackfill" })
                return parts
            }
            if (input.lastUpdateAt !== null)
                parts.push({ kind: "updated", at: input.lastUpdateAt })
            next("nextRefresh")
            open()
            return parts
    }
}

/** The chips under "Panely" ("5 zveřejněno", "1 chyba", …, P1-11), only the non-zero ones. */
export function panelStateCounts(
    states: readonly PanelDeliveryState[]
): Array<{ state: PanelDeliveryState; count: number }> {
    const order: PanelDeliveryState[] = [
        "published",
        "error",
        "waiting",
        "unsent",
        "paused",
    ]
    return order
        .map((state) => ({
            state,
            count: states.filter((value) => value === state).length,
        }))
        .filter((entry) => entry.count > 0)
}

/** Whether the page should poll faster: the bot owes an answer within 15 s (P1-B09). */
export function panelPollInterval(states: readonly PanelDeliveryState[]) {
    return states.includes("waiting") ? 2_000 : 5_000
}

/**
 * Which messages a WD League panel owns (P1-20, P1-21): the table, and the
 * nearest fixtures with the recent results; a switched-off part has no row.
 */
export function leagueRows(
    options: {
        table: boolean
        fixtures: boolean
        recentResults: boolean
    } | null
): Array<"league-table" | "league-fixtures"> {
    const value = options ?? {
        table: true,
        fixtures: true,
        recentResults: true,
    }
    return [
        ...(value.table ? (["league-table"] as const) : []),
        ...(value.fixtures || value.recentResults
            ? (["league-fixtures"] as const)
            : []),
    ]
}

/** Live data counts as checked while a panel read it within three refreshes. */
const LIVE_READ_WINDOW_MS = 3 * 60_000

/**
 * "Živá data ✓" of a data source (P1-08, P1-B07, P2-07): the bot's live
 * read of the server through its panels. Limited when a panel of the server
 * had to fall back to collected data; null when no panel reads it.
 */
export function sourceLiveRead(input: {
    connectionId: string
    now: number
    panels: ReadonlyArray<{
        kind: PanelKind
        connectionId: string | null
        warnings: readonly string[]
        dataAt: number | null
    }>
}): "ok" | "limited" | null {
    // Only a server's own panel reads it live; "Naše servery" shows the
    // collected snapshot (P4-B08).
    const reading = input.panels.filter(
        (panel) =>
            panel.kind === "server" && panel.connectionId === input.connectionId
    )
    if (!reading.length) return null
    if (
        reading.some((panel) =>
            panel.warnings.includes("live_data_unavailable")
        )
    )
        return "limited"
    return reading.some(
        (panel) =>
            panel.dataAt !== null &&
            input.now - panel.dataAt <= LIVE_READ_WINDOW_MS
    )
        ? "ok"
        : null
}
