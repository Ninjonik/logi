/**
 * The clan's message settings of the "Zprávy a panely" page (board N1)
 * that the match messages read: the roster message's default look, the
 * publish dialog's defaults for the change post and the change DMs, and the
 * optional attendance post in the match thread, plus the per-message
 * switches of "Co bot posílá". Every field is optional in storage; a
 * missing value is the board's default, so older configurations stay valid.
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

// --- The per-message switches of "Co bot posílá" (board N1) -----------------

/**
 * The switches of the "Zprávy a panely" page that turn one bot message on or
 * off for the whole clan (N1-14, 16, 20, 23, 39, 42). All are on by default
 * (N1-B06); the roster-change defaults and the attendance post above keep
 * their own fields.
 */
export type MessageSwitches = {
    /** N1-14: the Debrief post in the match forum after the match. */
    debriefPost: boolean
    /** N1-16: the Discord scheduled event with the meeting time. */
    scheduledEvent: boolean
    /** N1-20: the match recap DM; each player can still turn it off. */
    matchRecapDm: boolean
    /** N1-23: the training result DM to the participants. */
    trainingResultDm: boolean
    /** N1-39: the DM to the applicant when an application is closed. */
    applicationCloseDm: boolean
    /** N1-42: the DM to the author when a ticket is closed. */
    ticketCloseDm: boolean
}

export const MESSAGE_SWITCH_KEYS = [
    "debriefPost",
    "scheduledEvent",
    "matchRecapDm",
    "trainingResultDm",
    "applicationCloseDm",
    "ticketCloseDm",
] as const satisfies ReadonlyArray<keyof MessageSwitches>

export type MessageSwitchKey = (typeof MESSAGE_SWITCH_KEYS)[number]

export const DEFAULT_MESSAGE_SWITCHES: MessageSwitches = {
    debriefPost: true,
    scheduledEvent: true,
    matchRecapDm: true,
    trainingResultDm: true,
    applicationCloseDm: true,
    ticketCloseDm: true,
}

/** The stored Discord configuration field of each switch. */
export const MESSAGE_SWITCH_FIELDS = {
    debriefPost: "debriefPostEnabled",
    scheduledEvent: "scheduledEventEnabled",
    matchRecapDm: "matchRecapDmEnabled",
    trainingResultDm: "trainingResultDmEnabled",
    applicationCloseDm: "applicationCloseDmEnabled",
    ticketCloseDm: "ticketCloseDmEnabled",
} as const satisfies Record<MessageSwitchKey, string>

export type StoredMessageSwitches = Partial<
    Record<(typeof MESSAGE_SWITCH_FIELDS)[MessageSwitchKey], unknown>
>

/** The clan's switches; a missing or broken value is on (N1-B06). */
export function resolveMessageSwitches(
    config: StoredMessageSwitches | null | undefined
): MessageSwitches {
    const read = (key: MessageSwitchKey) =>
        flag(
            config?.[MESSAGE_SWITCH_FIELDS[key]],
            DEFAULT_MESSAGE_SWITCHES[key]
        )
    return {
        debriefPost: read("debriefPost"),
        scheduledEvent: read("scheduledEvent"),
        matchRecapDm: read("matchRecapDm"),
        trainingResultDm: read("trainingResultDm"),
        applicationCloseDm: read("applicationCloseDm"),
        ticketCloseDm: read("ticketCloseDm"),
    }
}

/** Whether the clan sends this message; `false` only when switched off. */
export function isMessageEnabled(
    config: StoredMessageSwitches | null | undefined,
    key: MessageSwitchKey
) {
    return resolveMessageSwitches(config)[key]
}

/**
 * Everything the "Zprávy a panely" page saves besides the look and the
 * errors channel: the match message settings and the switches.
 */
export type MessageSettings = MatchMessageSettings & MessageSwitches

export const DEFAULT_MESSAGE_SETTINGS: MessageSettings = {
    ...DEFAULT_MATCH_MESSAGE_SETTINGS,
    ...DEFAULT_MESSAGE_SWITCHES,
}

/** The page's settings of a stored configuration, with the board's defaults. */
export function resolveMessageSettings(
    config:
        (StoredMatchMessageSettings & StoredMessageSwitches) | null | undefined
): MessageSettings {
    return {
        ...resolveMatchMessageSettings(config),
        ...resolveMessageSwitches(config),
    }
}

/** The stored fields of the page's settings, as written to the configuration. */
export type StoredMessageSettingsPatch = {
    rosterMessageVariant?: RosterMessageVariant
    rosterChangesPostDefault?: boolean
    rosterChangesDmDefault?: boolean
    attendanceNoticesInThread?: boolean
} & Partial<Record<(typeof MESSAGE_SWITCH_FIELDS)[MessageSwitchKey], boolean>>

/**
 * The stored fields for a (partial) change of the page's settings: the
 * match message settings under their stored names and each switch under
 * its `…Enabled` field. Settings that were not supplied are left out.
 */
export function messageSettingsPatch(
    patch: Partial<MessageSettings>
): StoredMessageSettingsPatch {
    const fields: StoredMessageSettingsPatch = {}
    if (isRosterMessageVariant(patch.rosterMessageVariant))
        fields.rosterMessageVariant = patch.rosterMessageVariant
    if (typeof patch.rosterChangesPost === "boolean")
        fields.rosterChangesPostDefault = patch.rosterChangesPost
    if (typeof patch.rosterChangesDm === "boolean")
        fields.rosterChangesDmDefault = patch.rosterChangesDm
    if (typeof patch.attendanceNoticesInThread === "boolean")
        fields.attendanceNoticesInThread = patch.attendanceNoticesInThread
    for (const key of MESSAGE_SWITCH_KEYS) {
        const value = patch[key]
        if (typeof value === "boolean")
            fields[MESSAGE_SWITCH_FIELDS[key]] = value
    }
    return fields
}
