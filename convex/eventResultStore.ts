import {
    createResultRevision,
    resultDraftSchema,
    resultRevisionSchema,
    type ResultDraft,
    type ResultRevision,
} from "../src/domain/match-results/result-revision"
import { resultSummaryPayload } from "../src/domain/api/result-summaries"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { resolveGameScope } from "../src/domain/games/game"
import type { Doc, Id } from "./_generated/dataModel"

export async function currentEventResult(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">
) {
    const row = await ctx.db
        .query("eventResultRevisions")
        .withIndex("eventId_version", (q) => q.eq("eventId", event._id))
        .order("desc")
        .first()
    if (!row) return null
    if (
        row.guildId !== event.guildId ||
        row.gameId !== resolveGameScope(event.gameId)
    )
        throw new Error(
            "Result scope changed. Restore the event scope or use a new event."
        )
    return resultRevisionSchema.parse(row.revision)
}
export async function appendEventResult(
    ctx: MutationCtx,
    eventId: Id<"events">,
    expected: number,
    revision: ResultRevision
) {
    const event = await ctx.db.get(eventId)
    if (!event) throw new Error("Event not found.")
    const previous = await currentEventResult(ctx, event)
    if (
        (previous?.version ?? 0) !== expected ||
        revision.version !== expected + 1
    )
        throw new Error("Result revision conflict.")
    const gameId = resolveGameScope(event.gameId)
    await ctx.db.insert("eventResultRevisions", {
        eventId,
        guildId: event.guildId,
        gameId,
        version: revision.version,
        revision,
    })
    await ctx.db.patch(eventId, {
        reviewedResult: resultSummaryPayload(revision),
        reviewedResultGameId: gameId,
        updatedAt: revision.createdAt,
    })
    return revision
}
export function legacyResultDraft(result: {
    sideA: string
    sideB: string
    score: { sideA: number; sideB: number }
}): ResultDraft {
    return {
        origin: "legacy_import",
        participants: [
            { id: "side-a", label: result.sideA, score: result.score.sideA },
            { id: "side-b", label: result.sideB, score: result.score.sideB },
        ],
        players: [],
        sessionLinks: [],
    }
}
export async function recordImportedResult(
    ctx: MutationCtx,
    eventId: Id<"events">,
    result: Parameters<typeof legacyResultDraft>[0]
) {
    const event = await ctx.db.get(eventId)
    if (!event || (event.kind ?? "match") !== "match") return
    // Legacy import callers remain data-only. Reviewed snapshots never move with a reimport.
    const previous = await currentEventResult(ctx, event)
    if (previous && previous.status !== "provisional") return
    // Older import contracts allow empty labels. Do not make their existing
    // transaction fail or manufacture an approvable result from incomplete data.
    const parsed = resultDraftSchema.safeParse(legacyResultDraft(result))
    if (!parsed.success) return
    const draft = parsed.data
    if (
        previous?.origin === "legacy_import" &&
        JSON.stringify(previous.participants) ===
            JSON.stringify(draft.participants)
    )
        return
    const revision = createResultRevision({
        previous,
        expectedRevision: previous?.version ?? 0,
        draft,
        action: "stage",
        actor: { id: "import", kind: "import" },
        now: new Date().toISOString(),
    })
    await appendEventResult(ctx, eventId, previous?.version ?? 0, revision)
}
