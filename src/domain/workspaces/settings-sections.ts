import type { GameId } from "@/domain/games/game"

export const SETTINGS_GROUPS = [
    "clan",
    "matches",
    "discord",
    "gameData",
    "web",
    "maintenance",
] as const
export type SettingsGroupId = (typeof SETTINGS_GROUPS)[number]

/** Clan settings pages in menu order; `games` limits a page to clans playing one of them. */
export const SETTINGS_SECTIONS = [
    { id: "profile", group: "clan" },
    { id: "games", group: "clan" },
    { id: "event-categories", group: "clan" },
    { id: "match-templates", group: "matches" },
    { id: "presets", group: "matches" },
    { id: "channels", group: "discord" },
    // "Zprávy a panely" (board N1) follows "Kanály a jazyk" in the Discord group.
    { id: "messages", group: "discord" },
    // "Grafika panelů" (board P8); it sits under "Panely v Discordu".
    { id: "panel-graphics", group: "discord" },
    // "Seed serverů" (board P3); it also sits under "Panely v Discordu".
    { id: "discord-seed", group: "discord" },
    { id: "commands", group: "discord" },
    { id: "roles", group: "discord" },
    { id: "membership", group: "discord" },
    { id: "tickets", group: "discord" },
    { id: "game-servers", group: "gameData" },
    { id: "league", group: "gameData", games: ["wardogs"] },
    { id: "website", group: "web" },
    { id: "calendar", group: "web" },
    { id: "webhooks", group: "web" },
    { id: "imports", group: "maintenance" },
    { id: "helper-data", group: "maintenance" },
] as const satisfies ReadonlyArray<{
    id: string
    group: SettingsGroupId
    games?: readonly GameId[]
}>

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"]

export function isSettingsSectionId(value: string): value is SettingsSectionId {
    return SETTINGS_SECTIONS.some((section) => section.id === value)
}

/** Pages that were merged into another page; old links redirect to it. */
const MERGED_SETTINGS_SECTIONS: ReadonlyMap<string, SettingsSectionId> =
    new Map([
        ["login", "website"],
        // "Příkaz /stats" became the "Příkazy" page (Discord redesign N3).
        ["stats", "commands"],
    ])

/** The page that now holds a merged page's settings, if `value` names one. */
export function mergedSettingsSection(
    value: string
): SettingsSectionId | undefined {
    return MERGED_SETTINGS_SECTIONS.get(value)
}

/** Sections a clan can open; game-specific pages appear only for clans playing that game. */
export function visibleSettingsSections(enabledGames: readonly GameId[]) {
    return SETTINGS_SECTIONS.filter(
        (section) =>
            !("games" in section) ||
            section.games.some((game) => enabledGames.includes(game))
    )
}

/** What the clan must set before matches can be announced and members recognised. */
export type SettingsRequirement = "enabledGames" | "announcements" | "clanRole"

export type SettingsSnapshot = {
    enabledGames: readonly GameId[]
    announcementsChannelId?: string
    clanRoleId?: string
    statsEnabled: boolean
    membershipEnabled: boolean
    ticketsEnabled: boolean
}

/**
 * - `ready`: set up and working.
 * - `attention`: a required setting is missing; `missing` names it.
 * - `off`: an optional feature the clan has not switched on.
 * - `none`: a page without a setup state, such as a tool or integration list.
 */
export type SettingsSectionState = "ready" | "attention" | "off" | "none"

export type SettingsSectionStatus = {
    state: SettingsSectionState
    missing: SettingsRequirement[]
}

const required = (missing: SettingsRequirement[]): SettingsSectionStatus => ({
    state: missing.length ? "attention" : "ready",
    missing,
})
const toggle = (enabled: boolean): SettingsSectionStatus => ({
    state: enabled ? "ready" : "off",
    missing: [],
})

export function settingsSectionStatus(
    id: SettingsSectionId,
    snapshot: SettingsSnapshot
): SettingsSectionStatus {
    switch (id) {
        case "games":
            return required(
                snapshot.enabledGames.length ? [] : ["enabledGames"]
            )
        case "channels":
            return required(
                snapshot.announcementsChannelId ? [] : ["announcements"]
            )
        case "roles":
            return required(snapshot.clanRoleId ? [] : ["clanRole"])
        case "membership":
            return toggle(snapshot.membershipEnabled)
        case "tickets":
            return toggle(snapshot.ticketsEnabled)
        default:
            return { state: "none", missing: [] }
    }
}

/** Progress through the settings every clan needs, in the order they unlock each other. */
export function settingsSetupProgress(snapshot: SettingsSnapshot) {
    const missing = SETTINGS_SECTIONS.flatMap(
        (section) => settingsSectionStatus(section.id, snapshot).missing
    )
    const total: SettingsRequirement[] = [
        "enabledGames",
        "announcements",
        "clanRole",
    ]
    return {
        done: total.length - missing.length,
        total: total.length,
        next: total.find((requirement) => missing.includes(requirement)),
    }
}

/** The page that fixes a missing requirement. */
export function settingsSectionForRequirement(
    requirement: SettingsRequirement
): SettingsSectionId {
    switch (requirement) {
        case "enabledGames":
            return "games"
        case "announcements":
            return "channels"
        case "clanRole":
            return "roles"
    }
}
