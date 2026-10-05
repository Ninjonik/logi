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
type ResultPanel = {
    id: string
    enabled: boolean
    createdAt: number
    channelId: string
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
/** Only reviewed results can create a publication. A missing page aborts cleanup:
 * configuration/query failure must never be interpreted as deleted events. */
export async function synchronizeResults(
    panel: ResultPanel,
    ports: ResultPorts
) {
    const prefix = `panel:${panel.id}:result:`
    const unseen = new Set(
        (await ports.bindings()).filter((key) => key.startsWith(prefix))
    )
    let cursor: string | null = null
    do {
        const page = await ports.page(cursor)
        if (!page) return
        for (const event of page.events) {
            const key = `${prefix}${event.id}`
            const known = unseen.delete(key)
            const reviewedAt = event.result?.reviewedAt
                ? Date.parse(event.result.reviewedAt)
                : NaN
            const reviewed =
                !!event.result &&
                ["confirmed", "corrected"].includes(event.result.status) &&
                Number.isFinite(reviewedAt)
            if (
                !known &&
                (!panel.enabled || !reviewed || reviewedAt < panel.createdAt)
            )
                continue
            await ports.publish(
                key,
                panel.enabled && reviewed ? panel.channelId : null,
                reviewed ? event : null
            )
        }
        cursor = page.cursor
    } while (cursor)
    for (const key of unseen) await ports.publish(key, null, null)
}
