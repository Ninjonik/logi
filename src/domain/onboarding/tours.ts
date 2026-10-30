/** Tours are account guidance, never an authorization decision. */
export type TourKind =
    "welcome" | "manager" | "competitions" | "member" | "competition-member"
export type ChapterId =
    | "welcome"
    | "workspace"
    | "mode"
    | "bot"
    | "overview"
    | "calendar"
    | "articles"
    | "players"
    | "performance"
    | "history"
    | "tracking"
    | "commands"
    | "match"
    | "signups"
    | "roster"
    | "attendance"
    | "results"
    | "training"
    | "presets"
    | "maps"
    | "membership"
    | "tickets"
    | "competitions"
    | "teams"
    | "panels"
    | "seeding"
    | "servers"
    | "settings"
    | "integrations"
    | "account"
    | "finish"
export type TourContext = {
    workspaceId?: string
    canManage: boolean
    limited: boolean
    botInside: boolean
}
export type OnboardingState = {
    dashboardSetupCompletedAt?: string
    workspaceTourCompletedAt?: Record<string, string>
}
export const TOUR_VERSION = 3

/** Role and mode are separate milestones: becoming an admin must trigger its own tour. */
export function tourKey(kind: TourKind, workspaceId?: string): string {
    return `tour-v${TOUR_VERSION}:${kind}:${kind === "welcome" ? "account" : (workspaceId ?? "account")}`
}
export function workspaceTour(context: TourContext): TourKind {
    return context.canManage
        ? context.limited
            ? "competitions"
            : "manager"
        : context.limited
          ? "competition-member"
          : "member"
}
export function nextTour(
    context: TourContext,
    completed: ReadonlySet<string>
): TourKind | null {
    if (!completed.has(tourKey("welcome"))) return "welcome"
    if (!context.workspaceId) return null
    const kind = workspaceTour(context)
    return completed.has(tourKey(kind, context.workspaceId)) ? null : kind
}
export function tourChapters(kind: TourKind, botInside: boolean): ChapterId[] {
    switch (kind) {
        case "welcome":
            return [
                "welcome",
                "workspace",
                "mode",
                ...(!botInside ? ["bot" as const] : []),
                "account",
                "finish",
            ]
        case "competitions":
            return [
                "overview",
                "teams",
                "players",
                "competitions",
                "settings",
                "account",
                "finish",
            ]
        case "competition-member":
            return ["overview", "account", "finish"]
        case "member":
            return [
                "overview",
                "calendar",
                "signups",
                "roster",
                "attendance",
                "articles",
                "account",
                "finish",
            ]
        case "manager":
            return [
                "overview",
                ...(!botInside ? ["bot" as const] : []),
                "settings",
                "players",
                "performance",
                "match",
                "signups",
                "roster",
                "attendance",
                "results",
                "history",
                "training",
                "calendar",
                "presets",
                "maps",
                "articles",
                "membership",
                "tickets",
                "competitions",
                "teams",
                "panels",
                "commands",
                "tracking",
                "seeding",
                "servers",
                "integrations",
                "account",
                "finish",
            ]
    }
}
export type TourBookmark<T extends string = ChapterId> = {
    step: T
    status: "active" | "done"
}
export function parseBookmark<T extends string>(
    raw: string | null,
    chapters: readonly T[]
): TourBookmark<T> | null {
    if (!raw) return null
    try {
        const value: unknown = JSON.parse(raw)
        if (
            !value ||
            typeof value !== "object" ||
            !("step" in value) ||
            !("status" in value)
        )
            return null
        const step = chapters.find((id) => id === value.step)
        return step && (value.status === "active" || value.status === "done")
            ? { step, status: value.status }
            : null
    } catch {
        return null
    }
}
/** Only known product routes; no URL supplied by stored progress is ever followed. */
export function chapterPath(chapter: ChapterId): string | null {
    const paths: Partial<Record<ChapterId, string>> = {
        overview: "",
        calendar: "/calendar",
        articles: "/articles",
        players: "/users",
        performance: "",
        match: "/matches/create",
        signups: "/matches",
        roster: "/rosters",
        attendance: "/rosters",
        results: "/matches",
        training: "/trainings",
        presets: "/settings/presets",
        maps: "/stratmaps",
        membership: "/settings/membership",
        tickets: "/settings/tickets",
        competitions: "/competitions",
        teams: "/teams",
        panels: "/settings/discord-panels",
        seeding: "/settings/discord-seed",
        servers: "/settings/game-servers",
        settings: "/settings",
        integrations: "/settings/website",
        bot: "/settings/setup",
        history: "/settings/game-servers#game-history",
        tracking: "/settings/league",
        commands: "/settings/commands",
    }
    return paths[chapter] ?? null
}
