/**
 * Managed publication keys (`discordPublications.key`) and the index ranges
 * that read them. The table holds one row per managed Discord message, keyed
 * by what owns it: `panel:<id>` and `panel:<id>:<part>` for the panels,
 * `calendar` for the calendar message, `seed:<kind>:<key>` for the seed,
 * `league:<id>` for the retired League cards and `event:<id>:<kind>` for
 * match messages. It grows for as long as a clan exists, so a reader that
 * runs on a timer takes one owner's keys through a prefix range of the
 * `guild_key` index, never a guild's whole table (ARCHITECTURE.md, "Convex
 * hot paths").
 */

export const PANEL_KEY_PREFIX = "panel:"
export const CALENDAR_PUBLICATION_KEY = "calendar"
export const LEAGUE_CARD_KEY_PREFIX = "league:"

/** `panel:<id>`: a panel's own message, and the start of its parts' keys. */
export function panelPublicationKey(panelId: string) {
    return `${PANEL_KEY_PREFIX}${panelId}`
}

/** `panel:<id>:`: the parts of one panel (`result:<eventId>`, `division:<name>`, `standings`, …). */
export function panelPartKeyPrefix(panelId: string) {
    return `${panelPublicationKey(panelId)}:`
}

/**
 * The half-open range `[start, end)` of every key that starts with
 * `prefix`: the end is the prefix with its last character stepped up
 * (`seed:` → `seed;`). Keys are ASCII, so the index order and this range
 * agree. An empty prefix has no range: it means every key of the guild.
 */
export function publicationKeyRange(
    prefix: string
): { start: string; end: string } | null {
    if (!prefix) return null
    const last = prefix.charCodeAt(prefix.length - 1)
    return {
        start: prefix,
        end: prefix.slice(0, -1) + String.fromCharCode(last + 1),
    }
}
