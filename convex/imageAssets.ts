import {
    canAttachImageAsset,
    cleanupDue,
    IMAGE_CLEANUP_BATCH,
    IMAGE_OUTPUT,
    IMAGE_UPLOAD_LIMIT,
    imagePublicIdSchema,
    projectImageAsset,
    type ImageAssetEntity,
    type ImageAssetKind,
} from "../src/domain/assets/image-asset"
import {
    internalMutation,
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { imageAssetKind, imageContentType } from "./teamValidators"
import { assertSessionGateway } from "./dashboardSessionStore"
import type { Doc, Id } from "./_generated/dataModel"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
type Db = Pick<QueryCtx, "db">
export type AssetOwner = "team" | "event" | "panel"

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

async function referenced(ctx: Db, assetId: Id<"imageAssets">) {
    return (
        (await ctx.db
            .query("imageAssetReferences")
            .withIndex("assetId", (q) => q.eq("assetId", assetId))
            .first()) !== null
    )
}

async function consumeUploadAttempt(ctx: MutationCtx, bucket: string) {
    const now = Date.now()
    const existing = await ctx.db
        .query("apiRateLimitBuckets")
        .withIndex("bucket", (q) => q.eq("bucket", bucket))
        .unique()
    if (!existing || existing.resetAt <= now) {
        const resetAt = now + IMAGE_UPLOAD_LIMIT.windowMs
        if (existing) await ctx.db.patch(existing._id, { count: 1, resetAt })
        else
            await ctx.db.insert("apiRateLimitBuckets", {
                bucket,
                count: 1,
                resetAt,
            })
        return { allowed: true as const, retryAfterMs: 0 }
    }
    if (existing.count >= IMAGE_UPLOAD_LIMIT.attempts)
        return { allowed: false as const, retryAfterMs: existing.resetAt - now }
    await ctx.db.patch(existing._id, { count: existing.count + 1 })
    return { allowed: true as const, retryAfterMs: 0 }
}

/** Counts one upload attempt per actor and workspace before any bytes are accepted. */
export const reserveUpload = mutation({
    args: { ...access, kind: imageAssetKind },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const attempt = await consumeUploadAttempt(
            ctx,
            `image-upload:${args.guildId}:${admin.session.subject}`
        )
        if (!attempt.allowed)
            return {
                error: "upload_limited" as const,
                retryAfterMs: attempt.retryAfterMs,
            }
        return {
            ok: true as const,
            uploadUrl: await ctx.storage.generateUploadUrl(),
        }
    },
})

/** Records a normalized image the gateway has already validated and stored. */
export const create = mutation({
    args: {
        ...access,
        asset: v.object({
            kind: imageAssetKind,
            publicId: v.string(),
            storageId: v.id("_storage"),
            contentType: imageContentType,
            width: v.number(),
            height: v.number(),
            bytes: v.number(),
            sha256: v.string(),
            publicUrl: v.string(),
        }),
    },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const asset = args.asset,
            bounds = IMAGE_OUTPUT[asset.kind]
        if (
            !imagePublicIdSchema.safeParse(asset.publicId).success ||
            !/^[a-f0-9]{64}$/.test(asset.sha256) ||
            !Number.isInteger(asset.width) ||
            !Number.isInteger(asset.height) ||
            !Number.isInteger(asset.bytes) ||
            asset.width < 1 ||
            asset.height < 1 ||
            asset.bytes < 1 ||
            asset.width > bounds.width ||
            asset.height > bounds.height ||
            asset.publicUrl.length > 512 ||
            !/^https?:\/\//.test(asset.publicUrl)
        )
            return { error: "invalid_asset" as const }
        if (
            await ctx.db
                .query("imageAssets")
                .withIndex("publicId", (q) => q.eq("publicId", asset.publicId))
                .unique()
        )
            return { error: "invalid_asset" as const }
        const id = await ctx.db.insert("imageAssets", {
            guildId: args.guildId,
            ...asset,
            state: "ready",
            createdAt: new Date().toISOString(),
            createdBy: admin.session.subject,
        })
        const row = await ctx.db.get(id)
        return {
            ok: true as const,
            asset: projectImageAsset(imageAssetEntity(row!)),
        }
    },
})

/** Serves the immutable public file; the gateway adds nosniff and caching headers. */
export const resolvePublic = query({
    args: { secret: v.string(), publicId: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (!imagePublicIdSchema.safeParse(args.publicId).success) return null
        const row = await ctx.db
            .query("imageAssets")
            .withIndex("publicId", (q) => q.eq("publicId", args.publicId))
            .unique()
        if (!row || row.state !== "ready") return null
        const url = await ctx.storage.getUrl(row.storageId)
        return url ? { url, contentType: row.contentType } : null
    },
})

/** Dashboard listing of this workspace's live assets of one kind (bounded). */
export const list = query({
    args: { ...access, kind: imageAssetKind },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const rows = await ctx.db
            .query("imageAssets")
            .withIndex("guildId_kind", (q) =>
                q.eq("guildId", args.guildId).eq("kind", args.kind)
            )
            .take(200)
        return {
            assets: rows
                .filter((row) => row.state === "ready")
                .map((row) => projectImageAsset(imageAssetEntity(row))),
        }
    },
})

/**
 * Claims unreferenced uploads older than the retention window, then removes the
 * blob and the record. Referenced assets are never touched; batches are bounded.
 */
export const cleanupUnattached = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const cutoff = new Date(now - 24 * 60 * 60_000).toISOString()
        const candidates = await ctx.db
            .query("imageAssets")
            .withIndex("state_createdAt", (q) =>
                q.eq("state", "ready").lte("createdAt", cutoff)
            )
            .take(IMAGE_CLEANUP_BATCH)
        let deleted = 0
        for (const row of candidates) {
            if (!cleanupDue(row, await referenced(ctx, row._id), now)) continue
            // Claim first so a concurrent attach observes a non-attachable state.
            await ctx.db.patch(row._id, { state: "deleting" })
            await ctx.storage.delete(row.storageId)
            await ctx.db.delete(row._id)
            deleted++
        }
        if (candidates.length === IMAGE_CLEANUP_BATCH)
            await ctx.scheduler.runAfter(
                0,
                makeFunctionReference<"mutation">(
                    "imageAssets:cleanupUnattached"
                ),
                {}
            )
        return { deleted }
    },
})
