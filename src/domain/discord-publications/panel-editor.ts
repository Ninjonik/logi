import {
    DEFAULT_PANEL_LAYOUT,
    PANEL_ACCENT_COLOR_PATTERN,
    type PanelLayout,
    type PanelPresentation,
} from "./panel-presentation"
import {
    DEFAULT_PANEL_CONTENT,
    PANEL_KINDS,
    type PanelContent,
    type PanelGame,
    type PanelKind,
} from "./settings"
import {
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    type LeaguePanelOptions,
} from "../wardogs-league/panels"
import { isServerAddress, serverPasswordSchema } from "./server-join"
import type { PanelStyle } from "./panel-graphics"

/**
 * The panel editor of "Panely v Discordu" (board P2): the editable draft,
 * how it maps to and from the stored settings (`panelSaveSchema`), how many
 * changes are unsaved, which types can still be chosen and when a server
 * password may be shown. Pure; the page owns the requests.
 */

/** The panel types the editor offers, in board order (P2-04); a competition table follows. */
export const EDITOR_PANEL_KINDS = [
    "server",
    "servers",
    "results",
    "league",
    "calendar",
    "competition",
] as const satisfies readonly PanelKind[]

/** The editor's settings, as the overview hands them over (`PanelOverviewItem.settings`). */
export type PanelEditorSettings = {
    kind: PanelKind
    channelId: string
    connectionId?: string
    connectionIds?: string[]
    gameId?: string
    title?: string
    description?: string
    showPlayers: boolean
    showLeaders: boolean
    reportCategoryId?: string
    artwork: boolean
    content: PanelContent
    presentation?: Partial<PanelPresentation>
    league?: LeaguePanelOptions
    calendarCategories?: string[]
    competitionId?: string
}

export type PanelEditorDraft = {
    kind: PanelKind
    channelId: string
    /** The live server (kind `server`). */
    connectionId: string
    /** "Naše servery" in message order (kind `servers`). */
    connectionIds: string[]
    /** The game of a results panel. */
    gameId: PanelGame
    title: string
    description: string
    showPlayers: boolean
    showLeaders: boolean
    /** "Nahlásit hráče" with its ticket category; off without one (P2-19, P2-B05). */
    report: boolean
    reportCategoryId: string
    artwork: boolean
    content: PanelContent
    layout: PanelLayout
    /** "Podle klanu" or "Vlastní barva" (P2-24, P2-B07). */
    accent: "clan" | "custom"
    accentColor: string
    bannerAssetId: string | null
    bannerUrl: string | null
    /** The panel's own style; null follows "Grafika panelů" (P7-06, P2-B16). */
    style: PanelStyle | null
    league: LeaguePanelOptions
    calendarCategories: string[]
    competitionId: string
}

export const DEFAULT_CUSTOM_ACCENT = "#2BB3A3"

/** A new panel: a live server in no channel yet, everything shown except the password. */
export function newPanelDraft(
    input: {
        kind?: PanelKind
        connectionId?: string | null
        gameId?: PanelGame
    } = {}
): PanelEditorDraft {
    return {
        kind: input.kind ?? "server",
        channelId: "",
        connectionId: input.connectionId ?? "",
        connectionIds: input.connectionId ? [input.connectionId] : [],
        gameId: input.gameId ?? "hell_let_loose",
        title: "",
        description: "",
        showPlayers: true,
        showLeaders: true,
        report: false,
        reportCategoryId: "",
        artwork: true,
        content: { ...DEFAULT_PANEL_CONTENT },
        layout: { ...DEFAULT_PANEL_LAYOUT },
        accent: "clan",
        accentColor: DEFAULT_CUSTOM_ACCENT,
        bannerAssetId: null,
        bannerUrl: null,
        style: null,
        league: { ...DEFAULT_LEAGUE_PANEL_OPTIONS },
        calendarCategories: [],
        competitionId: "",
    }
}

const isPanelGame = (value: string | undefined): value is PanelGame =>
    value === "hell_let_loose" || value === "wardogs"

/** The draft of a stored panel. */
export function draftFromSettings(
    settings: PanelEditorSettings
): PanelEditorDraft {
    const base = newPanelDraft()
    const look = settings.presentation
    const accent = look?.accentColor ?? null
    return {
        ...base,
        kind: settings.kind,
        channelId: settings.channelId,
        connectionId: settings.connectionId ?? "",
        connectionIds: settings.connectionIds ?? [],
        gameId: isPanelGame(settings.gameId) ? settings.gameId : base.gameId,
        title: settings.title ?? "",
        description: settings.description ?? "",
        showPlayers: settings.showPlayers,
        showLeaders: settings.showLeaders,
        report: Boolean(settings.reportCategoryId),
        reportCategoryId: settings.reportCategoryId ?? "",
        artwork: settings.artwork,
        content: { ...DEFAULT_PANEL_CONTENT, ...settings.content },
        layout: { ...DEFAULT_PANEL_LAYOUT, ...look?.layout },
        accent: accent ? "custom" : "clan",
        accentColor: accent ? accent.toUpperCase() : base.accentColor,
        bannerAssetId: look?.bannerAssetId ?? null,
        bannerUrl: look?.bannerUrl ?? null,
        style: look?.style ?? null,
        league: { ...DEFAULT_LEAGUE_PANEL_OPTIONS, ...settings.league },
        calendarCategories: settings.calendarCategories ?? [],
        competitionId: settings.competitionId ?? "",
    }
}

/**
 * The save body (`panelSaveSchema`). Only the kind's own source fields are
 * sent; the old per-panel faction emoji are gone (P8-B06), so none are sent.
 */
export function draftToSettings(draft: PanelEditorDraft) {
    const kind = draft.kind
    const accentColor =
        draft.accent === "custom" &&
        PANEL_ACCENT_COLOR_PATTERN.test(draft.accentColor.trim())
            ? draft.accentColor.trim().toLowerCase()
            : null
    return {
        kind,
        channelId: draft.channelId,
        ...(kind === "server" ? { connectionId: draft.connectionId } : {}),
        ...(kind === "servers" ? { connectionIds: draft.connectionIds } : {}),
        ...(kind === "results" ? { gameId: draft.gameId } : {}),
        ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
        ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
        showPlayers: draft.showPlayers,
        showLeaders: draft.showLeaders,
        ...(kind === "server" && draft.report && draft.reportCategoryId
            ? { reportCategoryId: draft.reportCategoryId }
            : {}),
        artwork: draft.artwork,
        content: draft.content,
        presentation: {
            layout: draft.layout,
            accentColor,
            bannerAssetId: draft.bannerAssetId,
            factionEmoji: {},
            style: draft.style,
        },
        ...(kind === "league" ? { league: draft.league } : {}),
        ...(kind === "calendar"
            ? { calendarCategories: draft.calendarCategories }
            : {}),
        ...(kind === "competition"
            ? { competitionId: draft.competitionId }
            : {}),
    }
}

/** Per-server join details edited next to the panel (P2-15, P2-39, P2-40). */
export type ServerJoinDraft = {
    address: string
    joinCode: string
    /** A new password typed in; empty keeps the stored one. */
    password: string
    /** Remove the stored password. */
    clearPassword: boolean
}

export type ServerJoinSaved = {
    address: string | null
    joinCode: string | null
    hasPassword: boolean
}

export function serverJoinDraft(
    saved: ServerJoinSaved | null
): ServerJoinDraft {
    return {
        address: saved?.address ?? "",
        joinCode: saved?.joinCode ?? "",
        password: "",
        clearPassword: false,
    }
}

/** The `PUT …/servers/{connectionId}` body of an edited server, or null when nothing changed. */
export function serverJoinPatch(
    draft: ServerJoinDraft,
    saved: ServerJoinSaved | null
): {
    address?: string | null
    joinCode?: string | null
    password?: string | null
} | null {
    const patch: {
        address?: string | null
        joinCode?: string | null
        password?: string | null
    } = {}
    const address = draft.address.trim()
    if (address !== (saved?.address ?? "")) patch.address = address || null
    const joinCode = draft.joinCode.trim()
    if (joinCode !== (saved?.joinCode ?? "")) patch.joinCode = joinCode || null
    if (draft.password) patch.password = draft.password
    else if (draft.clearPassword && saved?.hasPassword) patch.password = null
    return Object.keys(patch).length ? patch : null
}

/** Field problems of one server's join details, shown under the inputs. */
export function serverJoinProblems(draft: ServerJoinDraft) {
    const problems: Array<"address" | "joinCode" | "password"> = []
    if (draft.address.trim() && !isServerAddress(draft.address.trim()))
        problems.push("address")
    if (
        draft.joinCode.trim() &&
        !/^[A-Za-z0-9-]{1,24}$/.test(draft.joinCode.trim())
    )
        problems.push("joinCode")
    if (
        draft.password &&
        !serverPasswordSchema.safeParse(draft.password).success
    )
        problems.push("password")
    return problems
}

const same = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right)

/** How many settings differ from what is stored ("1 neuložená změna", P2-34). */
export function draftChanges(
    draft: PanelEditorDraft,
    saved: PanelEditorDraft
): number {
    const left = draftToSettings(draft) as Record<string, unknown>
    const right = draftToSettings(saved) as Record<string, unknown>
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    let count = 0
    for (const key of keys) {
        if (key === "content" || key === "presentation") {
            const a = (left[key] ?? {}) as Record<string, unknown>
            const b = (right[key] ?? {}) as Record<string, unknown>
            for (const field of new Set([...Object.keys(a), ...Object.keys(b)]))
                if (!same(a[field], b[field])) count++
        } else if (!same(left[key], right[key])) count++
    }
    return count
}

/** Missing required settings; the save buttons stay off until none is left. */
export type DraftProblem =
    | "channel"
    | "server"
    | "servers"
    | "reportCategory"
    | "accentColor"
    | "competition"
    | "fixtureCount"

export function draftProblems(draft: PanelEditorDraft): DraftProblem[] {
    const problems: DraftProblem[] = []
    if (!/^\d{17,20}$/.test(draft.channelId)) problems.push("channel")
    if (draft.kind === "server" && !draft.connectionId) problems.push("server")
    if (draft.kind === "servers" && !draft.connectionIds.length)
        problems.push("servers")
    if (draft.kind === "server" && draft.report && !draft.reportCategoryId)
        problems.push("reportCategory")
    if (
        draft.accent === "custom" &&
        !PANEL_ACCENT_COLOR_PATTERN.test(draft.accentColor.trim())
    )
        problems.push("accentColor")
    if (draft.kind === "competition" && !draft.competitionId)
        problems.push("competition")
    if (
        draft.kind === "league" &&
        (!Number.isInteger(draft.league.fixtureCount) ||
            draft.league.fixtureCount < 1 ||
            draft.league.fixtureCount > 10)
    )
        problems.push("fixtureCount")
    return problems
}

/** P2-05: a sent panel keeps its type; the other cards are disabled. */
export function panelTypeOptions(input: {
    current: PanelKind
    sent: boolean
    /** Kinds a workspace may have only once and already has (results per game, League, calendar). */
    taken?: readonly PanelKind[]
}) {
    return EDITOR_PANEL_KINDS.map((kind) => ({
        kind,
        selected: kind === input.current,
        disabled:
            (input.sent && kind !== input.current) ||
            (kind !== input.current && (input.taken ?? []).includes(kind)),
    }))
}

/**
 * Whether the server password may be shown (P2-17, P2-40, P2-B03): only a
 * live server's own panel, only in a channel `@everyone` cannot view. Null
 * privacy (not checked yet) does not allow it.
 */
export function passwordAllowed(input: {
    kind: PanelKind
    channelPrivate: boolean | null
}): boolean {
    return input.kind === "server" && input.channelPrivate === true
}

/** Moves one server of "Naše servery" to a new position (drag order, P2-36). */
export function moveServer(
    ids: readonly string[],
    from: number,
    to: number
): string[] {
    if (from === to || from < 0 || from >= ids.length) return [...ids]
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!)
    return next
}

/** Adds or removes a server of "Naše servery", keeping the order of the others. */
export function toggleServer(ids: readonly string[], id: string, on: boolean) {
    if (on) return ids.includes(id) ? [...ids] : [...ids, id]
    return ids.filter((value) => value !== id)
}

export function isPanelKind(value: string): value is PanelKind {
    return (PANEL_KINDS as readonly string[]).includes(value)
}
