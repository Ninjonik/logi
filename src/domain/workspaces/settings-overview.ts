import type { SettingsSectionId, SettingsSnapshot } from "./settings-sections"

/**
 * Facts the settings overview shows beside the snapshot (design A1). A value
 * that could not be read is `undefined`, and the overview then shows no state
 * for it instead of a guess.
 */
export type SettingsOverviewFacts = {
    botInside: boolean
    profile: { name: boolean; logo: boolean; description: boolean }
    templateCount: number
    /** Game servers whose data collection is switched on. */
    collectingServers?: number
    /** Game servers whose collection stopped with an error. */
    failingServers?: number
    leagueEnabled?: boolean
}

export const SETTINGS_SETUP_STEPS = [
    "bot",
    "games",
    "profile",
    "channels",
    "roles",
    "gameServers",
] as const
export type SettingsSetupStepId = (typeof SETTINGS_SETUP_STEPS)[number]

/**
 * - `done`: finished.
 * - `next`: the first unfinished step; the overview highlights it.
 * - `todo`: unfinished, after the next step.
 */
export type SettingsSetupStepState = "done" | "next" | "todo"

export type SettingsSetupStep = {
    id: SettingsSetupStepId
    state: SettingsSetupStepState
    optional: boolean
    /** The settings page that finishes this step; the bot step has none. */
    section?: SettingsSectionId
}

const STEP_SECTIONS: Record<
    SettingsSetupStepId,
    SettingsSectionId | undefined
> = {
    bot: undefined,
    games: "games",
    profile: "profile",
    channels: "channels",
    roles: "roles",
    gameServers: "game-servers",
}

function stepDone(
    id: SettingsSetupStepId,
    snapshot: SettingsSnapshot,
    facts: SettingsOverviewFacts
): boolean {
    switch (id) {
        case "bot":
            return facts.botInside
        case "games":
            return snapshot.enabledGames.length > 0
        case "profile":
            // The description is optional (design B); name and logo finish the step.
            return facts.profile.name && facts.profile.logo
        case "channels":
            return Boolean(snapshot.announcementsChannelId)
        case "roles":
            return Boolean(snapshot.clanRoleId)
        case "gameServers":
            return (facts.collectingServers ?? 0) > 0
    }
}

/**
 * The first-setup checklist: six steps in the order they unlock each other,
 * game servers last and optional. The first unfinished step is `next`.
 */
export function settingsSetupSteps(
    snapshot: SettingsSnapshot,
    facts: SettingsOverviewFacts
) {
    let nextFound = false
    const steps: SettingsSetupStep[] = SETTINGS_SETUP_STEPS.map((id) => {
        const done = stepDone(id, snapshot, facts)
        const state: SettingsSetupStepState = done
            ? "done"
            : nextFound
              ? "todo"
              : "next"
        if (!done) nextFound = true
        return {
            id,
            state,
            optional: id === "gameServers",
            section: STEP_SECTIONS[id],
        }
    })
    const required = steps.filter((step) => !step.optional)
    return {
        steps,
        done: steps.filter((step) => step.state === "done").length,
        total: steps.length,
        /** Every required step is done; the checklist can step aside. */
        complete: required.every((step) => step.state === "done"),
        next: steps.find((step) => step.state === "next"),
    }
}

/**
 * The state a settings tile shows next to its title.
 * - `ready`: done, in green.
 * - `attention`: a required setting is missing, in amber.
 * - `neutral`: a plain fact such as a count or on/off.
 */
export type SettingsTileBadge =
    | { tone: "ready"; kind: "done" }
    | { tone: "ready"; kind: "collecting"; count: number }
    | { tone: "attention"; kind: "missingChannels"; count: number }
    | { tone: "attention"; kind: "notSet" }
    | { tone: "attention"; kind: "failing"; count: number }
    | { tone: "neutral"; kind: "gamesOn"; count: number }
    | { tone: "neutral"; kind: "templates"; count: number }
    | { tone: "neutral"; kind: "on" }
    | { tone: "neutral"; kind: "off" }

/** The badge of one overview tile, or `null` when the page has no state to show. */
export function settingsTileBadge(
    section: SettingsSectionId,
    snapshot: SettingsSnapshot,
    facts: SettingsOverviewFacts
): SettingsTileBadge | null {
    switch (section) {
        case "profile":
            return stepDone("profile", snapshot, facts)
                ? { tone: "ready", kind: "done" }
                : null
        case "games":
            return {
                tone: "neutral",
                kind: "gamesOn",
                count: snapshot.enabledGames.length,
            }
        case "match-templates":
            return facts.templateCount > 0
                ? {
                      tone: "neutral",
                      kind: "templates",
                      count: facts.templateCount,
                  }
                : null
        case "channels":
            return snapshot.announcementsChannelId
                ? { tone: "ready", kind: "done" }
                : { tone: "attention", kind: "missingChannels", count: 1 }
        case "roles":
            return snapshot.clanRoleId
                ? { tone: "ready", kind: "done" }
                : { tone: "attention", kind: "notSet" }
        case "game-servers":
            if (facts.failingServers)
                return {
                    tone: "attention",
                    kind: "failing",
                    count: facts.failingServers,
                }
            return facts.collectingServers
                ? {
                      tone: "ready",
                      kind: "collecting",
                      count: facts.collectingServers,
                  }
                : null
        case "league":
            return facts.leagueEnabled === undefined
                ? null
                : { tone: "neutral", kind: facts.leagueEnabled ? "on" : "off" }
        default:
            return null
    }
}
