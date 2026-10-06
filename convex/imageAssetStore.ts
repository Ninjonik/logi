import {
    canAttachImageAsset,
    type ImageAssetEntity,
    type ImageAssetKind,
} from "../src/domain/assets/image-asset"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { PLATFORM_SCOPE } from "./platformAdmin"

/**
 * Image asset lookups and reference bookkeeping other modules call inside
 * their own transactions. Kept apart from `imageAssets.ts`, whose upload
 * functions would otherwise be bundled into every module that only attaches
 * or resolves an asset.
 */
type Db = Pick<QueryCtx, "db">
export type AssetOwner =
    "team" | "event" | "panel" | "teamRequest" | "panelGraphics"

/**
 * Moves a request's logo from the requesting workspace to the platform when a
 * global administrator approves it. Only a live team logo of that workspace
 * (or one the platform already owns) can be adopted.
 */
export async function adoptablePlatformLogo(
    ctx: Pick<MutationCtx, "db">,
    input: { assetId: string; fromGuildId: string }
): Promise<Doc<"imageAssets"> | null> {
    const id = ctx.db.normalizeId("imageAssets", input.assetId)
    const row = id ? await ctx.db.get(id) : null
    return row &&
        row.kind === "team-logo" &&
        row.state === "ready" &&
        (row.guildId === input.fromGuildId || row.guildId === PLATFORM_SCOPE)
        ? row
        : null
}

export async function adoptPlatformLogo(
    ctx: MutationCtx,
    input: { assetId: string; fromGuildId: string }
): Promise<Id<"imageAssets"> | null> {
    const row = await adoptablePlatformLogo(ctx, input)
    if (!row) return null
    if (row.guildId !== PLATFORM_SCOPE)
        await ctx.db.patch(row._id, { guildId: PLATFORM_SCOPE })
    return row._id
}

export function imageAssetEntity(row: Doc<"imageAssets">): ImageAssetEntity {
    return {
        id: String(row._id),
        guildId: row.guildId,
        kind: row.kind,
        publicId: row.publicId,
        contentType: row.contentType,
        width: row.width,
        height: row.height,
        bytes: row.bytes,
        publicUrl: row.publicUrl,
        state: row.state,
        createdAt: row.createdAt,
    }
}

/** The asset a workspace may attach for this purpose, or null; never trusts the caller's ID alone. */
export async function attachableAsset(
    ctx: Db,
    input: { assetId: string; guildId: string; kind: ImageAssetKind }
): Promise<Doc<"imageAssets"> | null> {
    const id = ctx.db.normalizeId("imageAssets", input.assetId)
    const row = id ? await ctx.db.get(id) : null
    return row && canAttachImageAsset(row, input) ? row : null
}

/** Public URL for a stored asset; referenced assets are never deleted, so a URL stays valid. */
export async function assetPublicUrl(
    ctx: Db,
    assetId: Id<"imageAssets"> | string | null
): Promise<string | null> {
    if (!assetId) return null
    const id = ctx.db.normalizeId("imageAssets", String(assetId))
    const row = id ? await ctx.db.get(id) : null
    return row?.publicUrl ?? null
}

/** Reconciles indexed references for one owner inside the owner's own transaction. */
export async function syncAssetReferences(
    ctx: MutationCtx,
    input: {
        guildId: string
        owner: AssetOwner
        ownerId: string
        assetIds: readonly Id<"imageAssets">[]
    }
) {
    const current = await ctx.db
        .query("imageAssetReferences")
        .withIndex("owner_ownerId", (q) =>
            q.eq("owner", input.owner).eq("ownerId", input.ownerId)
        )
        .collect()
    const wanted = new Set(input.assetIds.map(String))
    for (const row of current)
        if (!wanted.has(String(row.assetId))) await ctx.db.delete(row._id)
    const have = new Set(current.map((row) => String(row.assetId)))
    for (const assetId of input.assetIds)
        if (!have.has(String(assetId)))
            await ctx.db.insert("imageAssetReferences", {
                assetId,
                guildId: input.guildId,
                owner: input.owner,
                ownerId: input.ownerId,
                createdAt: new Date().toISOString(),
            })
}
