/**
 * Drafts are events saved from the new-match flow before publishing. They live
 * in the events table with `isDraft: true` and are visible only to the clan's
 * managers in the dashboard: the bot, schedules, calendar feeds, public pages
 * and `/api/v1` treat them as if they did not exist.
 */
export type DraftFlagged = { isDraft?: boolean | null }

export function isDraftEvent(event: DraftFlagged | null | undefined): boolean {
    return event?.isDraft === true
}

/** The same check for a record of unknown shape, such as a generic sync payload. */
export function isDraftRecord(value: unknown): boolean {
    return (
        typeof value === "object" &&
        value !== null &&
        "isDraft" in value &&
        value.isDraft === true
    )
}

/** Published events only; every public or bot-facing read uses this. */
export function withoutDrafts<T extends DraftFlagged>(
    events: readonly T[]
): T[] {
    return events.filter((event) => !isDraftEvent(event))
}

export type EventDraftError = "not_found" | "not_draft"

/**
 * A draft action (save over, publish, delete) applies only to an existing
 * draft of the same clan. Another clan's event reads as missing, and a
 * published event can never be turned back into a draft or deleted here.
 */
export function eventDraftActionError(
    existing: (DraftFlagged & { guildId?: string }) | null,
    guildId: string
): EventDraftError | null {
    if (!existing || existing.guildId !== guildId) return "not_found"
    if (!isDraftEvent(existing)) return "not_draft"
    return null
}
