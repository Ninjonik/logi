/**
 * Names of the Discord roles and voice channels a match creates when its
 * template enables them (board L1 1.14, L1-144..146): roles "VLK vs ROG ·
 * Hráči" and "VLK vs ROG · Zálohy" with the suffix in the clan language, and
 * one voice channel per squad, "F1 · Pěchota", in the category "Čety · VLK vs
 * ROG".
 */

import type { MatchAnnouncementCopy } from "../discord-messages/match-announcement-copy"

/** Discord's limit for role and channel names. */
const NAME_LIMIT = 100

const oneLine = (value: string) => value.replace(/[\s\p{Cc}]+/gu, " ").trim()

/** "VLK vs ROG · Hráči" and "VLK vs ROG · Zálohy". */
export function matchRoleNames(title: string, copy: MatchAnnouncementCopy) {
    const base = oneLine(title)
    return {
        players: `${base} · ${copy.discord.players}`.slice(0, NAME_LIMIT),
        reserves: `${base} · ${copy.discord.reserves}`.slice(0, NAME_LIMIT),
    }
}

/** "Čety · VLK vs ROG": the match's category for its squad voice channels. */
export function squadCategoryName(title: string, copy: MatchAnnouncementCopy) {
    return `${copy.discord.squads} · ${oneLine(title)}`.slice(0, NAME_LIMIT)
}

export type SquadKind = "command" | "infantry" | "armor" | "recon" | "artillery"

const KINDS: Array<[SquadKind, RegExp]> = [
    ["artillery", /\b(arty|artil|děl|del[oa]|artiller)/],
    ["command", /\b(cmd|command|velen|veli|hq|führung|fuhrung|kommand)/],
    ["armor", /\b(armou?r|tank|panzer)/],
    ["recon", /\b(recon|průzk|pruzk|sniper|spotter|aufkl)/],
    ["infantry", /\b(inf|pěch|pech|rifle|squad)/],
]

/**
 * What a squad is, from its roster group ("Infantry", "Armor", "Command")
 * and, when the group says nothing, its name ("CMD", "Arty"). Null when
 * unknown.
 */
export function squadKindOf(squad: { group?: string | null; name: string }) {
    for (const value of [squad.group, squad.name]) {
        const normalized = value?.trim().toLowerCase()
        if (!normalized) continue
        for (const [kind, pattern] of KINDS)
            if (pattern.test(normalized)) return kind
    }
    return null
}

/**
 * "F1 · Pěchota": the squad and what it is in the clan language; an unknown
 * group keeps its own name, a squad without a group only its name.
 */
export function squadVoiceChannelName(
    squad: { group?: string | null; name: string },
    copy: MatchAnnouncementCopy
) {
    const name = oneLine(squad.name)
    const kind = squadKindOf(squad)
    const label = kind
        ? copy.discord.squadKinds[kind]
        : oneLine(squad.group ?? "")
    return (
        label && label.toLowerCase() !== name.toLowerCase()
            ? `${name} · ${label}`
            : name
    ).slice(0, NAME_LIMIT)
}
