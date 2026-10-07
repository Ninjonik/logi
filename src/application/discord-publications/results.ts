import type { ResultCardFacts } from "@/domain/discord-publications/result-card"

export type ResultEvent = {
    id: string
    name: string
    map: string | null
    /** Category, sides, confirming admin and public page; absent from older backends. */
    card?: ResultCardFacts | null
    result: {
        status: string
        version: number
        reviewedAt: string | null
        participants: { label: string; score: number | null }[]
    } | null
}
/** P6-B09: a new results panel first posts this many recent results. */
export const RESULTS_BACKFILL = 5
type ResultPanel = {
    id: string
    /** False withdraws every card (an unsent or removed panel). */
    enabled: boolean
    createdAt: number
    channelId: string
    /** Results confirmed before the panel existed to post, newest kept. */
    backfill?: number
}
type ResultPorts = {
    bindings(): Promise<string[]>
    page(
        cursor: string | null
    ): Promise<{ cursor: string | null; events: ResultEvent[] } | null>
    publish(
        key: string,
        target: string | null,
        event: ResultEvent | null
    ): Promise<void>
}
const reviewedAt = (event: ResultEvent) =>
    event.result?.reviewedAt ? Date.parse(event.result.reviewedAt) : NaN
const isReviewed = (event: ResultEvent) =>
    !!event.result &&
    ["confirmed", "corrected"].includes(event.result.status) &&
    Number.isFinite(reviewedAt(event))

/**
 * Which results the panel posts (P6-35, P6-36): every result confirmed after
 * the panel was created, plus the last `backfill` (5) confirmed before it.
 */
export function wantedResultIds(
    events: readonly ResultEvent[],
    panel: Pick<ResultPanel, "createdAt" | "backfill">
): Set<string> {
    const reviewed = events.filter(isReviewed)
    const earlier = reviewed
        .filter((event) => reviewedAt(event) < panel.createdAt)
        .sort((a, b) => reviewedAt(b) - reviewedAt(a))
        .slice(0, Math.max(0, panel.backfill ?? RESULTS_BACKFILL))
    return new Set([
        ...earlier.map((event) => event.id),
        ...reviewed
            .filter((event) => reviewedAt(event) >= panel.createdAt)
            .map((event) => event.id),
    ])
}

/**
 * One card per confirmed result, oldest first; a correction republishes the
 * same card and a withdrawn result removes it. A missing page aborts:
 * configuration/query failure must never be interpreted as deleted events.
 */
export async function synchronizeResults(
    panel: ResultPanel,
    ports: ResultPorts
) {
    const prefix = `panel:${panel.id}:result:`
    const unseen = new Set(
        (await ports.bindings()).filter((key) => key.startsWith(prefix))
    )
    const events: ResultEvent[] = []
    let cursor: string | null = null
    do {
        const page = await ports.page(cursor)
        if (!page) return
        events.push(...page.events)
        cursor = page.cursor
    } while (cursor)
    const wanted = wantedResultIds(events, panel)
    const ordered = events
        .map((event, index) => ({ event, index }))
        .sort(
            (a, b) =>
                (reviewedAt(a.event) || 0) - (reviewedAt(b.event) || 0) ||
                a.index - b.index
        )
        .map(({ event }) => event)
    for (const event of ordered) {
        const key = `${prefix}${event.id}`
        const known = unseen.delete(key)
        const reviewed = isReviewed(event)
        if (!known && (!panel.enabled || !wanted.has(event.id))) continue
        await ports.publish(
            key,
            panel.enabled && reviewed ? panel.channelId : null,
            reviewed ? event : null
        )
    }
    for (const key of unseen) await ports.publish(key, null, null)
}
