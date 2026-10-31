import {
    chapterPath,
    tourChapters,
    type ChapterId,
    type TourKind,
} from "./tours"
import type { NewMatchStep } from "@/domain/events/new-match-flow"
export type WalkStep = {
    id: string
    chapter: ChapterId
    path: string
    selector: string
    instruction?:
        | "playersNav"
        | "playerOpen"
        | "playerTrends"
        | "newMatch"
        | "matchWatch"
        | "matchContinue"
        | "matchTime"
        | "matchSignups"
        | "matchDiscord"
        | "matchReview"
        | "matchPublish"
    action?: "advance"
    mock: "players" | "profile" | "match" | "section"
    formStep?: NewMatchStep
    watch?: boolean
}
const page = "#onboarding-page"
const section = (chapter: ChapterId) =>
    `${page} [data-tour-section="${chapter}"]`
export function walkthroughSteps(
    kind: TourKind,
    botInside: boolean
): WalkStep[] {
    return tourChapters(kind, botInside).flatMap((chapter): WalkStep[] => {
        if (chapter === "players")
            return [
                {
                    id: "players-nav",
                    mock: "section",
                    chapter,
                    path: "",
                    selector:
                        '[data-tour-route$="/users"] [data-sidebar="menu-button"]',
                    instruction: "playersNav",
                    action: "advance",
                },
                {
                    id: "players",
                    chapter,
                    path: "/users",
                    selector: `${page} [data-tour-players]`,
                    mock: "players",
                },
                {
                    id: "player-open",
                    chapter,
                    path: "/users",
                    selector: `${page} a[href*="/users/onboarding-example"]`,
                    mock: "players",
                    instruction: "playerOpen",
                    action: "advance",
                },
                {
                    id: "player-trends",
                    chapter: "performance",
                    path: "/users/onboarding-example",
                    selector: `${page} [data-tour-player-trends]`,
                    mock: "profile",
                    instruction: "playerTrends",
                },
            ]
        if (chapter === "performance") return [] // Covered in the player's actual profile route above.
        if (chapter === "match")
            return [
                {
                    id: "match-new",
                    mock: "section",
                    chapter,
                    path: "/matches",
                    selector: `${page} a[href*="/matches/create"]`,
                    instruction: "newMatch",
                    action: "advance",
                },
                {
                    id: "match-watch",
                    chapter,
                    path: "/matches/create",
                    selector: `${page} section[aria-labelledby="new-match-step"]`,
                    mock: "match",
                    formStep: "match",
                    watch: true,
                    instruction: "matchWatch",
                },
                {
                    id: "match-continue",
                    chapter,
                    path: "/matches/create",
                    selector: "#onboarding-match-continue",
                    mock: "match",
                    formStep: "match",
                    instruction: "matchContinue",
                    action: "advance",
                },
                {
                    id: "match-time",
                    chapter,
                    path: "/matches/create",
                    selector: `${page} section[aria-labelledby="new-match-step"]`,
                    mock: "match",
                    formStep: "time",
                    instruction: "matchTime",
                },
                {
                    id: "match-time-next",
                    chapter,
                    path: "/matches/create",
                    selector: "#onboarding-match-continue",
                    mock: "match",
                    formStep: "time",
                    instruction: "matchContinue",
                    action: "advance",
                },
                {
                    id: "match-signups",
                    chapter,
                    path: "/matches/create",
                    selector: `${page} section[aria-labelledby="new-match-step"]`,
                    mock: "match",
                    formStep: "signups",
                    instruction: "matchSignups",
                },
                {
                    id: "match-signups-next",
                    chapter,
                    path: "/matches/create",
                    selector: "#onboarding-match-continue",
                    mock: "match",
                    formStep: "signups",
                    instruction: "matchContinue",
                    action: "advance",
                },
                {
                    id: "match-discord",
                    chapter,
                    path: "/matches/create",
                    selector: `${page} section[aria-labelledby="new-match-step"]`,
                    mock: "match",
                    formStep: "discord",
                    instruction: "matchDiscord",
                },
                {
                    id: "match-discord-next",
                    chapter,
                    path: "/matches/create",
                    selector: "#onboarding-match-continue",
                    mock: "match",
                    formStep: "discord",
                    instruction: "matchContinue",
                    action: "advance",
                },
                {
                    id: "match-review",
                    chapter,
                    path: "/matches/create",
                    selector: `${page} section[aria-labelledby="new-match-step"]`,
                    mock: "match",
                    formStep: "review",
                    instruction: "matchReview",
                },
                {
                    id: "match-publish",
                    chapter,
                    path: "/matches/create",
                    selector: `${page} [data-onboarding-publish]`,
                    mock: "match",
                    formStep: "review",
                    instruction: "matchPublish",
                    action: "advance",
                },
            ]
        const path =
            chapter === "mode" || chapter === "bot"
                ? "/settings"
                : (chapterPath(chapter) ?? "")
        // Explain a named section; only explicit click-to-advance steps target
        // individual actions. Avoid selecting an incidental first switch/card.
        const selectors: Record<
            Exclude<ChapterId, "players" | "performance" | "match">,
            string
        > = {
            finish: "#onboarding-restart-tour",
            bot: `${page} [data-tour-bot-setup]`,
            articles: section("articles"),
            training: section("training"),
            maps: section("maps"),
            presets: section("presets"),
            membership: `${page} #membership-panel`,
            tickets: `${page} section[aria-labelledby="ticket-panel-title"]`,
            commands: `${page} [data-tour-command="stats"]`,
            teams: section("teams"),
            competitions: section("competitions"),
            welcome: "#onboarding-workspace-switcher",
            workspace: "#onboarding-workspace-switcher",
            mode: `${page} [data-tour-workspace-mode]`,
            account: "#onboarding-account-menu",
            overview:
                kind === "competitions" || kind === "competition-member"
                    ? section("overview")
                    : `${page} [aria-labelledby="overview-next-match"]`,
            calendar: `${page} [data-tour-calendar]`,
            roster: section("roster"),
            attendance: section("attendance"),
            signups: section("signups"),
            results: section("results"),
            settings: `${page} section[aria-labelledby="settings-group-clan"]`,
            panels: section("panels"),
            seeding: section("seeding"),
            tracking: section("tracking"),
            history: `${page} #game-history`,
            servers: section("servers"),
            integrations: section("integrations"),
        }
        return [
            {
                id: chapter,
                mock: "section",
                chapter,
                path,
                selector: selectors[chapter],
            },
        ]
    })
}
export function walkHref(
    locale: string,
    workspaceId: string | undefined,
    step: WalkStep
) {
    const root = workspaceId
        ? `/${locale}/dashboard/servers/${workspaceId}`
        : `/${locale}/dashboard`
    if (step.chapter === "account")
        return `/${locale}/dashboard/settings/user${workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : ""}`
    return `${root}${step.path}${step.mock === "match" ? "?game=wardogs" : ""}`
}
export function matchesWalkRoute(pathname: string, href: string) {
    return pathname === href.split(/[?#]/)[0]
}
