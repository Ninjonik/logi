/**
 * The clan's message settings of the "Zprávy a panely" page (board N1)
 * that the match messages read: the roster message's default look, the
 * publish dialog's defaults for the change post and the change DMs, and the
 * optional attendance post in the match thread. Every field is optional in
 * storage; a missing value is the board's default.
 *
 * W9 owns the page and may add further switches here; keep additions
 * optional so older configurations stay valid.
 */

import {
    DEFAULT_ROSTER_MESSAGE_VARIANT,
    isRosterMessageVariant,
    type RosterMessageVariant,
} from "./roster-message"

export type MatchMessageSettings = {
    /** N1-11/N1-B05: "Fotka a text" (default) or "Jen fotka". */
    rosterMessageVariant: RosterMessageVariant
    /** N1-12: "Změny soupisky předvolit", on by default. */
    rosterChangesPost: boolean
    /** N1-24: "Změna zařazení předvolit", on by default. */
    rosterChangesDm: boolean
    /** N1-15: late and absence posts in the match thread, off by default. */
    attendanceNoticesInThread: boolean
}

export const DEFAULT_MATCH_MESSAGE_SETTINGS: MatchMessageSettings = {
    rosterMessageVariant: DEFAULT_ROSTER_MESSAGE_VARIANT,
    rosterChangesPost: true,
    rosterChangesDm: true,
    attendanceNoticesInThread: false,
}

/** The stored Discord configuration fields of these settings. */
export type StoredMatchMessageSettings = {
    rosterMessageVariant?: unknown
    rosterChangesPostDefault?: unknown
    rosterChangesDmDefault?: unknown
    attendanceNoticesInThread?: unknown
}

const flag = (value: unknown, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback

/** The settings of a stored configuration, with the board's defaults. */
export function resolveMatchMessageSettings(
    config: StoredMatchMessageSettings | null | undefined
): MatchMessageSettings {
    const defaults = DEFAULT_MATCH_MESSAGE_SETTINGS
    return {
        rosterMessageVariant: isRosterMessageVariant(
            config?.rosterMessageVariant
        )
            ? config.rosterMessageVariant
            : defaults.rosterMessageVariant,
        rosterChangesPost: flag(
            config?.rosterChangesPostDefault,
            defaults.rosterChangesPost
        ),
        rosterChangesDm: flag(
            config?.rosterChangesDmDefault,
            defaults.rosterChangesDm
        ),
        attendanceNoticesInThread: flag(
            config?.attendanceNoticesInThread,
            defaults.attendanceNoticesInThread
        ),
    }
}

/** The roster message's look for one publish: its own choice, else the clan default. */
export function resolveRosterMessageVariant(
    chosen: unknown,
    config: StoredMatchMessageSettings | null | undefined
): RosterMessageVariant {
    return isRosterMessageVariant(chosen)
        ? chosen
        : resolveMatchMessageSettings(config).rosterMessageVariant
}
