import type {
    PanelServerInfo,
    PanelSourceHealth,
    StoredPanel,
    StoredPublication,
} from "../src/application/discord-publications/panel-overview"
import {
    isPanelPaused,
    MAX_PANELS_PER_GUILD,
    normalizePanelKind,
} from "../src/domain/discord-publications/settings"
import type {
    PanelRowWrite,
    PanelSaveStore,
} from "../src/application/discord-publications/save-panel"
import type { PanelActionStore } from "../src/application/discord-publications/panel-actions"
import type { PanelStatusRecord } from "../src/domain/discord-publications/panel-delivery"
import { serverJoinUrl } from "../src/domain/discord-publications/server-join"
import { connectionSource, workspaceSources } from "./gameDataCatalog"
import { attachableAsset, syncAssetReferences } from "./imageAssets"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { projectHealth } from "../src/domain/game-data/policy"
import type { Doc, Id } from "./_generated/dataModel"

/**
 * Persistence of "Panely v Discordu" shared by the dashboard functions
 * (`discordPanels.ts`), the bot functions (`discordPanelBot.ts`) and the
 * legacy form (`discordPublicPanels.ts`). Every read is scoped to one guild.
 */
type Db = Pick<QueryCtx, "db">
/** Panels read per guild: the limit plus room for rows being removed. */
const PANEL_READ_LIMIT = MAX_PANELS_PER_GUILD + 10

export async function guildPanels(ctx: Db, guildId: string) {
    return await ctx.db
        .query("discordPublicPanels")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .take(PANEL_READ_LIMIT)
}

export async function guildPanel(ctx: Db, guildId: string, panelId: string) {
    const id = ctx.db.normalizeId("discordPublicPanels", panelId)
    const panel = id ? await ctx.db.get(id) : null
    return panel && panel.guildId === guildId ? panel : null
}

export async function panelStatusRow(ctx: Db, panelId: string) {
    return await ctx.db
        .query("discordPanelStatus")
        .withIndex("panelId", (q) => q.eq("panelId", panelId))
        .unique()
}

export function panelStatusRecord(
    row: Doc<"discordPanelStatus"> | null
): PanelStatusRecord | null {
    if (!row) return null
    return {
        claimedAt: row.claimedAt,
        attemptAt: row.attemptAt,
        successAt: row.successAt,
        nextAt: row.nextAt,
        dataAt: row.dataAt,
        handledRequestAt: row.handledRequestAt,
        error: row.error as PanelStatusRecord["error"],
        warnings: row.warnings as PanelStatusRecord["warnings"],
        messages: row.messages,
        sentAt: row.sentAt,
        lastError: (row.lastError ??
            row.error ??
            null) as PanelStatusRecord["error"],
        channelPrivate: row.channelPrivate ?? null,
        recoveredAt: row.recoveredAt ?? null,
    }
}

/** A publication key belongs to a panel: `panel:<id>` and `panel:<id>:…`. */
export function isPanelKey(key: string, panelId: string) {
    return key === `panel:${panelId}` || key.startsWith(`panel:${panelId}:`)
}
/** The calendar keeps the key of the old calendar message, so it is edited, not reposted. */
export function panelOwnsKey(
    panel: Pick<Doc<"discordPublicPanels">, "_id" | "kind">,
    key: string
) {
    return (
        isPanelKey(key, String(panel._id)) ||
        (panel.kind === "calendar" && key === "calendar")
    )
}

export async function guildPublications(ctx: Db, guildId: string) {
    return await ctx.db
        .query("discordPublications")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
}

export function storedPublication(
    row: Doc<"discordPublications">
): StoredPublication {
    return {
        key: row.key,
        channelId: row.channelId,
        messageId: row.messageId,
        pending: Boolean(row.pending),
        lastSuccessAt: row.lastSuccessAt,
        retryAt: row.retryAt,
        error: row.error,
    }
}

export function storedPanel(row: Doc<"discordPublicPanels">): StoredPanel {
    return {
        id: String(row._id),
        kind: row.kind,
        gameId: row.gameId,
        channelId: row.channelId,
        ...(row.connectionId ? { connectionId: row.connectionId } : {}),
        ...(row.connectionIds ? { connectionIds: row.connectionIds } : {}),
        ...(row.title ? { title: row.title } : {}),
        ...(row.description ? { description: row.description } : {}),
        enabled: row.enabled,
        paused: row.paused,
        pausedAt: row.pausedAt ?? null,
        pausedBy: row.pausedBy ?? null,
        draft: row.draft,
        removing: row.removing,
        showPlayers: row.showPlayers,
        showLeaders: row.showLeaders,
        reportCategoryId: row.reportCategoryId,
        artwork: row.artwork,
        content: row.content,
        presentation: row.presentation ?? null,
        league: row.league,
        calendarCategories: row.calendarCategories,
        competitionId: row.competitionId,
        savedAt: row.savedAt,
        savedBy: row.savedBy,
        requestedAt: row.requestedAt,
        requestKind: row.requestKind,
        revision: row.revision,
        createdAt: row.createdAt,
    }
}

/** Logi's own name of each server ("Vlci #1 · Public"), by connection ID. */
export async function serverNames(ctx: Db, guildId: string) {
    const [connections, sources] = await Promise.all([
        ctx.db
            .query("gameDataConnections")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        workspaceSources(ctx, guildId),
    ])
    const names = new Map(
        sources.map((entry) => [
            entry.source.ref,
            entry.row?.displayName ?? null,
        ])
    )
    return new Map(
        connections.map((row) => [
            String(row._id),
            names.get(row.sourceRef) ?? row.observation?.displayName ?? null,
        ])
    )
}

/** Collection health per server for "Zdroje dat" (P1-07..10, P2-07, P2-30). */
export async function sourceHealth(
    ctx: Db,
    guildId: string,
    now: number
): Promise<PanelSourceHealth[]> {
    const [rows, names] = await Promise.all([
        ctx.db
            .query("gameDataConnections")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        serverNames(ctx, guildId),
    ])
    const usable = await Promise.all(
        rows.map(async (row) => Boolean(await connectionSource(ctx, row)))
    )
    return rows.flatMap((row, index) => {
        if (!usable[index]) return []
        const health = projectHealth(
            {
                ...row,
                id: String(row._id),
                lastAttemptAt: row.lastAttemptAt ?? null,
                errorCategory: row.errorCategory ?? null,
            },
            now
        )
        return [
            {
                connectionId: String(row._id),
                name: names.get(String(row._id)) ?? null,
                gameId: row.gameId,
                provider: row.provider,
                collecting: row.enabled,
                lastDataAt: health.lastSuccessAt
                    ? Date.parse(health.lastSuccessAt)
                    : null,
                freshness: health.freshness,
                errorCategory: health.errorCategory,
            },
        ]
    })
}

export async function panelServerRow(
    ctx: Db,
    guildId: string,
    connectionId: string
) {
    return await ctx.db
        .query("discordPanelServers")
        .withIndex("guild_connection", (q) =>
            q.eq("guildId", guildId).eq("connectionId", connectionId)
        )
        .unique()
}

export async function panelServerInfos(
    ctx: Db,
    guildId: string
): Promise<PanelServerInfo[]> {
    const rows = await ctx.db
        .query("discordPanelServers")
        .withIndex("guild_connection", (q) => q.eq("guildId", guildId))
        .collect()
    const site = process.env.SITE_URL ?? ""
    return rows.map((row) => ({
        connectionId: row.connectionId,
        slug: row.slug,
        joinUrl: site ? serverJoinUrl(site, row.slug) : null,
        address: row.address,
        joinCode: row.joinCode,
        hasPassword: row.password !== null,
    }))
}

/** The action store over one transaction (`requestPanelAction`). */
export function panelActionStore(ctx: MutationCtx): PanelActionStore {
    return {
        async panel(guildId, panelId) {
            const row = await guildPanel(ctx, guildId, panelId)
            return row
                ? {
                      id: String(row._id),
                      guildId: row.guildId,
                      draft: Boolean(row.draft),
                      paused: isPanelPaused(row),
                      removing: Boolean(row.removing),
                  }
                : null
        },
        async patch(panelId, patch) {
            const id = ctx.db.normalizeId("discordPublicPanels", panelId)
            if (!id) throw new Error("Panel unavailable.")
            await ctx.db.patch(id, patch)
        },
        async resetDelivery(guildId, panelId, options) {
            const panel = await guildPanel(ctx, guildId, panelId)
            if (!panel) return
            for (const row of await guildPublications(ctx, guildId)) {
                if (!panelOwnsKey(panel, row.key)) continue
                // A running delivery keeps its lease; only waits are cleared.
                if (row.leaseUntil > Date.now()) continue
                await ctx.db.patch(row._id, {
                    retryAt: 0,
                    ...(options.abandonPending && row.pending
                        ? { pending: null, error: null }
                        : {}),
                })
            }
        },
    }
}

/** The save store (`savePanel`); the banner comes from the verified asset only. */
export function panelSaveStore(ctx: MutationCtx): PanelSaveStore {
    return {
        async panels(guildId) {
            const [rows, publications, statuses] = await Promise.all([
                guildPanels(ctx, guildId),
                guildPublications(ctx, guildId),
                ctx.db
                    .query("discordPanelStatus")
                    .withIndex("guildId", (q) => q.eq("guildId", guildId))
                    .collect(),
            ])
            return rows.flatMap((row) => {
                const kind = normalizePanelKind(row.kind)
                if (!kind) return []
                const status = statuses.find(
                    (entry) => entry.panelId === String(row._id)
                )
                const sent =
                    Boolean(status?.sentAt) ||
                    publications.some(
                        (publication) =>
                            panelOwnsKey(row, publication.key) &&
                            publication.messageId !== null
                    ) ||
                    // Panels saved by the old form were posted on save.
                    row.draft === undefined
                return [
                    {
                        id: String(row._id),
                        kind,
                        channelId: row.channelId,
                        connectionId: row.connectionId ?? null,
                        gameId: row.gameId,
                        draft: Boolean(row.draft),
                        removing: Boolean(row.removing),
                        sent,
                        revision: row.revision,
                    },
                ]
            })
        },
        async connections(guildId) {
            const rows = await ctx.db
                .query("gameDataConnections")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect()
            const usable = await Promise.all(
                rows.map(async (row) =>
                    Boolean(await connectionSource(ctx, row))
                )
            )
            return rows
                .filter(
                    (row, index) =>
                        usable[index] &&
                        (row.gameId === "hell_let_loose" ||
                            row.gameId === "wardogs")
                )
                .map((row) => ({
                    id: String(row._id),
                    gameId: row.gameId as "hell_let_loose" | "wardogs",
                    provider: row.provider,
                }))
        },
        async reportCategories(guildId) {
            const config = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .unique()
            const tickets = config?.ticketSettings
            return tickets?.enabled && tickets.ticketParentChannelId
                ? tickets.categories.map((category) => category.id)
                : null
        },
        async competition(competitionId) {
            const id = ctx.db.normalizeId("competitions", competitionId)
            const row = id ? await ctx.db.get(id) : null
            if (!row) return null
            return {
                id: String(row._id),
                gameId: row.gameId === "wardogs" ? "wardogs" : "hell_let_loose",
            }
        },
        async write({ guildId, id, row }) {
            const bannerAssetId = row.presentation?.bannerAssetId ?? null
            let banner: { id: Id<"imageAssets">; url: string | null } | null =
                null
            if (bannerAssetId) {
                const asset = await attachableAsset(ctx, {
                    assetId: bannerAssetId,
                    guildId,
                    kind: "panel-banner",
                })
                if (!asset) return { error: "asset_unavailable" }
                banner = { id: asset._id, url: asset.publicUrl }
            }
            const value = panelRowValue(row, banner)
            let panelId: Id<"discordPublicPanels">
            if (id) {
                const existing = await guildPanel(ctx, guildId, id)
                if (!existing) throw new Error("Panel unavailable.")
                panelId = existing._id
                // Fields the editor cleared are removed, not kept.
                await ctx.db.replace(panelId, {
                    ...value,
                    guildId,
                    createdAt: existing.createdAt,
                    // Saving never resumes a panel; a legacy disabled row
                    // (`enabled: false`) stays paused under the new flag.
                    paused: isPanelPaused(existing),
                    ...(existing.pausedAt !== undefined
                        ? { pausedAt: existing.pausedAt }
                        : {}),
                    ...(existing.pausedBy !== undefined
                        ? { pausedBy: existing.pausedBy }
                        : {}),
                    ...(value.requestedAt === undefined &&
                    existing.requestedAt !== undefined
                        ? {
                              requestedAt: existing.requestedAt,
                              requestKind: existing.requestKind,
                          }
                        : {}),
                })
            } else {
                panelId = await ctx.db.insert("discordPublicPanels", {
                    ...value,
                    guildId,
                    createdAt: row.savedAt,
                })
            }
            await syncAssetReferences(ctx, {
                guildId,
                owner: "panel",
                ownerId: String(panelId),
                assetIds: banner ? [banner.id] : [],
            })
            return { id: String(panelId) }
        },
    }
}

/** The stored row of a saved panel; `bannerUrl` only from the verified asset. */
function panelRowValue(
    row: PanelRowWrite,
    banner: { id: Id<"imageAssets">; url: string | null } | null
) {
    const { presentation, ...rest } = row
    return {
        ...rest,
        ...(presentation
            ? {
                  presentation: {
                      layout: presentation.layout,
                      accentColor: presentation.accentColor,
                      bannerAssetId: banner ? String(banner.id) : null,
                      bannerUrl: banner?.url ?? null,
                      factionEmoji: presentation.factionEmoji,
                      ...(presentation.style !== undefined
                          ? { style: presentation.style }
                          : {}),
                  },
              }
            : {}),
    }
}

/** Removes a panel row with its delivery status once its messages are gone. */
export async function purgePanel(
    ctx: MutationCtx,
    panel: Doc<"discordPublicPanels">
) {
    const publications = (await guildPublications(ctx, panel.guildId)).filter(
        (row) => panelOwnsKey(panel, row.key)
    )
    if (publications.some((row) => row.messageId || row.pending)) return false
    for (const row of publications) await ctx.db.delete(row._id)
    const status = await panelStatusRow(ctx, String(panel._id))
    if (status) await ctx.db.delete(status._id)
    await syncAssetReferences(ctx, {
        guildId: panel.guildId,
        owner: "panel",
        ownerId: String(panel._id),
        assetIds: [],
    })
    await ctx.db.delete(panel._id)
    return true
}
