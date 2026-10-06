import { syncAssetReferences } from "../../../convex/imageAssetStore"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Doc, Id } from "../../../convex/_generated/dataModel"

/**
 * Keeps an event's image references (its match teams' logos) in step with
 * the event row. Apart from the team directory repositories so an event
 * write does not bundle the whole team catalogue behind them.
 */
export async function syncEventAssetReferences(
    ctx: MutationCtx,
    event: Pick<Doc<"events">, "_id" | "guildId" | "matchTeams">
) {
    const assetIds: Id<"imageAssets">[] = []
    for (const assignment of event.matchTeams ?? []) {
        const id = assignment.snapshot.logoAssetId
            ? ctx.db.normalizeId("imageAssets", assignment.snapshot.logoAssetId)
            : null
        if (id && !assetIds.includes(id)) assetIds.push(id)
    }
    await syncAssetReferences(ctx, {
        guildId: event.guildId,
        owner: "event",
        ownerId: String(event._id),
        assetIds,
    })
}
