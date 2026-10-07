import {
    panelEmojiReportSchema,
    panelGraphicsPatchSchema,
    panelGraphicsSettingsSchema,
    applyPanelGraphicsPatch,
    type PanelGraphicsPatch,
} from "../src/domain/discord-publications/panel-graphics-settings"
import {
    emojiReport,
    graphicsConnections,
    settingsOf,
    stored,
} from "./discordPanelGraphicsStore"
import { panelEmojiStatus } from "../src/domain/discord-publications/panel-graphics-projection"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { attachableAsset, syncAssetReferences } from "./imageAssetStore"
import { canonicalJson } from "../src/domain/game-data/canonical-json"
import { mutation, type MutationCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

/**
 * The writes of "Grafika panelů" (P8): the dashboard's partial change and
 * the bot's emoji report, both validated with Zod. They live apart from the
 * reads in `discordPanelGraphics.ts`, which the bot calls on every panel
 * pass (ARCHITECTURE.md, "Convex hot paths").
 */
const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}

type UpdateResult =
    | { ok: true; revision: number }
    | {
          error: "conflict" | "asset_unavailable" | "unknown_server"
      }

async function verifiedAsset(
    ctx: MutationCtx,
    guildId: string,
    assetId: string,
    kind: "panel-banner" | "panel-map"
) {
    return await attachableAsset(ctx, { assetId, guildId, kind })
}

export type PanelGraphicsChange =
    | { ok: true; commit(updatedBy: string): Promise<number> }
    | { error: "conflict" | "asset_unavailable" | "unknown_server" }

/**
 * Validates a partial change against the stored settings, this workspace's
 * game servers and its own uploads, without writing. `commit` then stores it
 * and keeps the asset references in step. Used by the dashboard and by
 * `/api/v1` clan settings, so both apply exactly the same rules.
 */
export async function preparePanelGraphicsChange(
    ctx: MutationCtx,
    guildId: string,
    patch: PanelGraphicsPatch
): Promise<PanelGraphicsChange> {
    const row = await stored(ctx, guildId)
    const revision = row?.revision ?? 0
    if (
        patch.expectedRevision !== undefined &&
        patch.expectedRevision !== revision
    )
        return { error: "conflict" }
    const next = applyPanelGraphicsPatch(settingsOf(row), patch)
    const known = new Set(
        (await graphicsConnections(ctx, guildId)).map((c) => c.id)
    )
    if ((patch.servers ?? []).some((server) => !known.has(server.connectionId)))
        return { error: "unknown_server" }
    const servers: Doc<"discordPanelGraphics">["servers"] = []
    // A removed game server's banner settings are dropped with this save.
    for (const server of next.servers.filter((s) =>
        known.has(s.connectionId)
    )) {
        const asset = server.bannerAssetId
            ? await verifiedAsset(
                  ctx,
                  guildId,
                  server.bannerAssetId,
                  "panel-banner"
              )
            : null
        if (server.bannerAssetId && !asset)
            return { error: "asset_unavailable" }
        servers.push({
            connectionId: server.connectionId,
            bannerAssetId: asset?._id ?? null,
            bannerPublicId: asset?.publicId ?? null,
            bannerUrl: asset?.publicUrl ?? null,
            crop: server.crop,
            useMapImage: server.useMapImage,
            barColor: server.barColor,
        })
    }
    const maps: Doc<"discordPanelGraphics">["maps"] = []
    for (const map of next.maps) {
        const asset = await verifiedAsset(
            ctx,
            guildId,
            map.assetId,
            "panel-map"
        )
        if (!asset) return { error: "asset_unavailable" }
        maps.push({
            game: map.game,
            mapKey: map.mapKey,
            assetId: asset._id,
            publicId: asset.publicId,
            url: asset.publicUrl,
        })
    }
    // Defence in depth: the stored document always passes the domain schema.
    panelGraphicsSettingsSchema.parse(next)
    return {
        ok: true,
        commit: async (updatedBy) => {
            const value = {
                guildId,
                defaultStyle: next.defaultStyle,
                servers,
                maps,
                revision: revision + 1,
                updatedAt: Date.now(),
                updatedBy,
            }
            if (row) await ctx.db.patch(row._id, value)
            else await ctx.db.insert("discordPanelGraphics", value)
            // Referenced banners and map images survive the unattached-upload
            // sweep; removed ones are released in this same transaction.
            await syncAssetReferences(ctx, {
                guildId,
                owner: "panelGraphics",
                ownerId: guildId,
                assetIds: [
                    ...servers.flatMap((s) =>
                        s.bannerAssetId ? [s.bannerAssetId] : []
                    ),
                    ...maps.map((m) => m.assetId),
                ],
            })
            return value.revision
        },
    }
}

/** Applies a partial change after verifying every server and asset. */
export const update = mutation({
    args: { ...access, patch: v.any() },
    handler: async (ctx, args): Promise<UpdateResult> => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const patch = panelGraphicsPatchSchema.parse(args.patch)
        const change = await preparePanelGraphicsChange(
            ctx,
            args.guildId,
            patch
        )
        if (!("ok" in change)) return change
        return {
            ok: true,
            revision: await change.commit(admin.session.subject),
        }
    },
})

/**
 * The bot reports which application emoji are installed (P8-20, P8-24),
 * hourly. A report whose content is the stored one, `checkedAt` aside, is
 * not stored again; the row keeps the check that found this state.
 */
export const reportEmoji = mutation({
    args: { secret: v.string(), report: v.any() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const report = panelEmojiReportSchema.parse(args.report)
        const row = await emojiReport(ctx)
        const { checkedAt: _checkedAt, ...content } = report
        const unchanged =
            row !== null &&
            Object.entries(content).every(
                ([key, value]) =>
                    canonicalJson(row[key as keyof typeof content]) ===
                    canonicalJson(value)
            )
        const value = { key: "global" as const, ...report }
        if (!row) await ctx.db.insert("discordApplicationEmoji", value)
        else if (!unchanged) await ctx.db.patch(row._id, value)
        return panelEmojiStatus(report)
    },
})
