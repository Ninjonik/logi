import {
    CHANGE_RETENTION_MS,
    nextRevision,
    readsChangeFeed,
    revisionOrder,
    type FeedResource,
    type IntegrationChange,
} from "../src/domain/integrations/change"
import type { MutationCtx, QueryCtx } from "./_generated/server"

export function integrationRecord(
    ctx: Pick<QueryCtx, "db">,
    identity: Omit<IntegrationChange, "revision" | "operation">
) {
    return ctx.db
        .query("integrationRecords")
        .withIndex("identity", (q) =>
            q
                .eq("guildId", identity.guildId)
                .eq("gameId", identity.gameId)
                .eq("resource", identity.resource)
                .eq("id", identity.id)
        )
        .unique()
}

export async function allocateIntegrationRevision(
    ctx: MutationCtx,
    guildId: string
): Promise<string> {
    const head = await ctx.db
        .query("integrationHeads")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    const revision = nextRevision(head?.revision ?? "0")
    if (head) await ctx.db.patch(head._id, { revision })
    else
        await ctx.db.insert("integrationHeads", {
            guildId,
            revision,
            floor: "0",
        })
    return revision
}

/**
 * Whether any key of the guild reads its feed ({@link readsChangeFeed}),
 * through the `guildId` index of `apiKeys`: a clan has a handful of keys.
 */
export async function guildReadsChangeFeed(
    ctx: Pick<QueryCtx, "db">,
    guildId: string
): Promise<boolean> {
    const keys = await ctx.db
        .query("apiKeys")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    return keys.some(readsChangeFeed)
}

/**
 * Called only inside the authoritative writer's transaction; never an action.
 * Returns the new revision, or `null` without writing anything when no key
 * of the guild reads the feed. The feed is polled; it enqueues no webhook.
 */
export async function appendIntegrationChange(
    ctx: MutationCtx,
    change: Omit<IntegrationChange, "revision" | "resource"> & {
        resource: FeedResource
    }
): Promise<string | null> {
    if (!(await guildReadsChangeFeed(ctx, change.guildId))) return null
    const revision = await allocateIntegrationRevision(ctx, change.guildId),
        expiresAt = Date.now() + CHANGE_RETENTION_MS
    await ctx.db.insert("integrationChanges", {
        ...change,
        revision,
        revisionOrder: revisionOrder(revision),
        expiresAt,
    })
    const previous = await integrationRecord(ctx, change)
    const record = {
        ...change,
        revision,
        expiresAt: change.operation === "remove" ? expiresAt : undefined,
    }
    if (previous) await ctx.db.patch(previous._id, record)
    else await ctx.db.insert("integrationRecords", record)
    return revision
}
