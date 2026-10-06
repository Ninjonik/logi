import {
    isPanelPaused,
    publicPanelSettingsSchema,
    type PublicPanelSaveResult,
} from "../src/domain/discord-publications/settings"
import {
    guildPanels,
    panelPublications,
    panelServerRow,
    serverNames,
} from "./discordPanelStore"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { buildResultCardFacts } from "../src/domain/discord-publications/result-card"
import { leagueSnapshotSchema } from "../src/domain/wardogs-league/contracts"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { attachableAsset, syncAssetReferences } from "./imageAssets"
import { getGuildByDiscordId, getUserByDiscordId } from "./identity"
import { projectSnapshot } from "../src/domain/game-data/policy"
import { panelSettingsInput } from "./discordPublicationTable"
import type { Doc, Id } from "./_generated/dataModel"
import { connectionSource } from "./gameDataCatalog"
import { v } from "convex/values"

function secretGuard(secret: string) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
}
/** A banner must be this workspace's live `panel-banner` upload; the URL is read from the asset. */
async function resolveBanner(
    ctx: MutationCtx,
    guildId: string,
    bannerAssetId: string | null
): Promise<
    | { id: Id<"imageAssets"> | null; url: string | null }
    | { error: "asset_unavailable" }
> {
    if (!bannerAssetId) return { id: null, url: null }
    const asset = await attachableAsset(ctx, {
        assetId: bannerAssetId,
        guildId,
        kind: "panel-banner",
    })
    return asset
        ? { id: asset._id, url: asset.publicUrl }
        : { error: "asset_unavailable" }
}
export const configure = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        settings: v.object(panelSettingsInput),
        verifiedChannel: v.object({
            id: v.string(),
            guildId: v.string(),
            type: v.number(),
            canPublish: v.boolean(),
        }),
    },
    handler: async (ctx, args): Promise<PublicPanelSaveResult> => {
        await authorizeDashboardAdmin(ctx, args)
        const settings = publicPanelSettingsSchema.parse(args.settings)
        const channel = args.verifiedChannel
        if (
            channel.id !== settings.channelId ||
            channel.guildId !== args.guildId ||
            ![0, 5].includes(channel.type) ||
            (settings.enabled && !channel.canPublish)
        )
            throw new Error("Channel cannot publish.")
        const connectionId = ctx.db.normalizeId(
            "gameDataConnections",
            settings.connectionId
        )
        const connection = connectionId ? await ctx.db.get(connectionId) : null
        if (!connection || connection.guildId !== args.guildId)
            throw new Error("Source not found.")
        if (settings.reportCategoryId) {
            const config = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique()
            if (
                settings.kind === "results" ||
                !["hll_crcon", "wardogs_warcon"].includes(
                    connection.provider
                ) ||
                !config?.ticketSettings?.enabled ||
                !config.ticketSettings.ticketParentChannelId ||
                !config.ticketSettings.categories.some(
                    (c) => c.id === settings.reportCategoryId
                )
            )
                throw new Error(
                    "Configure a private ticket destination and category first."
                )
        }
        const rows = await ctx.db
            .query("discordPublicPanels")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(21)
        const old = rows.find(
            (row) =>
                row.connectionId === settings.connectionId &&
                row.kind === settings.kind
        )
        // P6-34: a second results panel of one game would post every result twice.
        if (
            settings.kind === "results" &&
            rows.some(
                (row) =>
                    row._id !== old?._id &&
                    row.kind === "results" &&
                    row.gameId === connection.gameId &&
                    !row.removing
            )
        )
            throw new Error("One results panel per game.")
        if (
            settings.enabled &&
            settings.kind !== "results" &&
            rows.some(
                (row) =>
                    row._id !== old?._id &&
                    row.enabled &&
                    row.kind !== "results" &&
                    row.connectionId === settings.connectionId &&
                    row.channelId === settings.channelId
            )
        )
            throw new Error(
                "Use a different channel for a separate scoreboard."
            )
        const banner = await resolveBanner(
            ctx,
            args.guildId,
            settings.presentation?.bannerAssetId ?? null
        )
        if ("error" in banner) return { error: banner.error }
        const now = Date.now()
        const value = {
            ...settings,
            // Saving without presentation clears a previous appearance together
            // with its banner reference, so stored URL and reference stay aligned.
            presentation: settings.presentation
                ? {
                      ...settings.presentation,
                      bannerAssetId: banner.id ? String(banner.id) : null,
                      bannerUrl: banner.url,
                  }
                : undefined,
            guildId: args.guildId,
            gameId: connection.gameId,
            revision: Math.max(now, (old?.revision ?? 0) + 1),
        }
        let panelId: Id<"discordPublicPanels">
        if (old) {
            await ctx.db.patch(old._id, value)
            panelId = old._id
        } else {
            if (rows.length >= 20) throw new Error("Panel limit reached.")
            panelId = await ctx.db.insert("discordPublicPanels", {
                ...value,
                createdAt: now,
            })
        }
        // ownerId is the panel document ID: one source/feature pair keeps the
        // same row across edits, so each save replaces exactly this panel's
        // references. A referenced banner survives the unattached-upload sweep;
        // clearing it (or saving without appearance) releases it in this transaction.
        await syncAssetReferences(ctx, {
            guildId: args.guildId,
            owner: "panel",
            ownerId: String(panelId),
            assetIds: banner.id ? [banner.id] : [],
        })
        return { ok: true, id: String(panelId) }
    },
})
export const list = query({
    args: { secret: v.string(), guildId: v.string(), actor: dashboardActor },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const panels = await ctx.db
            .query("discordPublicPanels")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(20)
        const publications = await panelPublications(ctx, args.guildId)
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        // The calendar panel ("Panely v Discordu"); its message keeps the
        // key `calendar`. "Zprávy a panely" shows it instead of the channel
        // saved before panels existed (N1-47).
        const calendar = panels.find(
            (p) => p.kind === "calendar" && !p.removing
        )
        const calendarMessage = publications.find((b) => b.key === "calendar")
        return {
            calendarPanel: calendar
                ? {
                      _id: calendar._id,
                      channelId: calendar.channelId,
                      paused: isPanelPaused(calendar),
                      draft: Boolean(calendar.draft),
                      messageId: calendarMessage?.messageId ?? null,
                      error: calendarMessage?.error ?? null,
                  }
                : null,
            reportCategories: config?.ticketSettings?.enabled
                ? config.ticketSettings.categories.map((c) => ({
                      id: c.id,
                      label: c.label || c.id,
                      parentChannelId:
                          config.ticketSettings!.ticketParentChannelId ?? null,
                  }))
                : [],
            // The old multi-panel form understands only its own kinds;
            // "Panely v Discordu" reads `discordPanels:overview`.
            panels: panels
                .filter(
                    (p) =>
                        ["server", "scoreboard", "results"].includes(p.kind) &&
                        Boolean(p.connectionId) &&
                        !p.removing
                )
                .map((p) => ({
                    ...p,
                    publications: publications
                        .filter(
                            (b) =>
                                b.key === `panel:${p._id}` ||
                                b.key.startsWith(`panel:${p._id}:`)
                        )
                        .map((b) => ({
                            key: b.key,
                            channelId: b.channelId,
                            messageId: b.messageId,
                            lastSuccessAt: b.lastSuccessAt,
                            error: b.error,
                            pending: Boolean(b.pending),
                            retryAt: b.retryAt,
                        })),
                })),
        }
    },
})
/**
 * Bot-only projection: no credentials, identity links or provider admin
 * URLs. Per panel: its server(s) with the collected snapshot, the server's
 * seed plan threshold and channel, the join details (a password only as
 * "stored or not") and the request the bot last answered.
 */
export const forGuild = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        secretGuard(args.secret)
        const [panels, names, plans, statuses] = await Promise.all([
            guildPanels(ctx, args.guildId),
            serverNames(ctx, args.guildId),
            ctx.db
                .query("discordSeedPlans")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect(),
            ctx.db
                .query("discordPanelStatus")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect(),
        ])
        const now = Date.now()
        const server = async (connectionId: string) => {
            const id = ctx.db.normalizeId("gameDataConnections", connectionId)
            const connection = id ? await ctx.db.get(id) : null
            if (!connection || connection.guildId !== args.guildId) return null
            const configured = Boolean(await connectionSource(ctx, connection))
            const plan = plans.find((row) => row.connectionId === connectionId)
            const join = await panelServerRow(ctx, args.guildId, connectionId)
            return {
                connectionId,
                name: names.get(connectionId) ?? null,
                gameId: connection.gameId,
                provider: connection.provider,
                snapshot:
                    connection.enabled && configured
                        ? projectSnapshot(
                              { ...connection, id: String(connection._id) },
                              now
                          )
                        : null,
                seedPlan: plan
                    ? {
                          liveFrom: plan.settings.liveFrom,
                          seedChannelId: plan.settings.seedChannelId,
                      }
                    : null,
                join: join
                    ? {
                          slug: join.slug,
                          address: join.address,
                          joinCode: join.joinCode,
                          hasPassword: join.password !== null,
                      }
                    : null,
            }
        }
        return Promise.all(
            panels.map(async (panel) => {
                const ids =
                    panel.kind === "servers"
                        ? (panel.connectionIds ?? [])
                        : panel.connectionId
                          ? [panel.connectionId]
                          : []
                const servers = (await Promise.all(ids.map(server))).filter(
                    (entry): entry is NonNullable<typeof entry> =>
                        entry !== null
                )
                const status = statuses.find(
                    (row) => row.panelId === String(panel._id)
                )
                return {
                    ...panel,
                    snapshot:
                        panel.connectionId && panel.kind !== "servers"
                            ? (servers[0]?.snapshot ?? null)
                            : null,
                    servers,
                    status: status
                        ? {
                              handledRequestAt: status.handledRequestAt,
                              passwordNotifiedAt:
                                  status.passwordNotifiedAt ?? null,
                              sentAt: status.sentAt,
                          }
                        : null,
                }
            })
        )
    },
})
/** Category, sides, confirming admin and public page of one reviewed result. */
async function resultCard(
    ctx: QueryCtx,
    event: Doc<"events">,
    result: NonNullable<Doc<"events">["reviewedResult"]>,
    guild: Doc<"guilds">,
    guildDiscordId: string
) {
    const version = result.version
    const [revision, stats, previous, league] = await Promise.all([
        ctx.db
            .query("eventResultRevisions")
            .withIndex("eventId_version", (q) =>
                q.eq("eventId", event._id).eq("version", version)
            )
            .unique(),
        ctx.db
            .query("matchStats")
            .withIndex("eventId", (q) => q.eq("eventId", event._id))
            .unique(),
        // L3-30: a correction says what the score was before.
        result.status === "corrected" && result.supersedesVersion !== null
            ? ctx.db
                  .query("eventResultRevisions")
                  .withIndex("eventId_version", (q) =>
                      q
                          .eq("eventId", event._id)
                          .eq("version", result.supersedesVersion!)
                  )
                  .unique()
            : null,
        // P6-38: a tracked WD League match names its fixture.
        (event.gameId ?? "hell_let_loose") === "wardogs"
            ? ctx.db
                  .query("leagueTrackedMatches")
                  .withIndex("event", (q) =>
                      q
                          .eq("guildId", guildDiscordId)
                          .eq("eventId", String(event._id))
                  )
                  .first()
            : null,
    ])
    const snapshot = league?.snapshotJson
        ? leagueSnapshotSchema.safeParse(JSON.parse(league.snapshotJson))
        : null
    // The reviewer is the confirming admin's Discord user ID.
    const reviewerId =
        revision && revision.guildId === event.guildId
            ? revision.revision.reviewerId
            : null
    const reviewer = reviewerId
        ? await getUserByDiscordId(ctx, reviewerId)
        : null
    return {
        ...buildResultCardFacts({
            event,
            categories: guild.eventCategories,
            reviewer,
            guildDiscordId,
            // The public match page exists only for matches with linked stats.
            publicMatch: Boolean(
                stats && event.matchStatsId && event.matchStatsId === stats._id
            ),
        }),
        playedAt: event.gameStart ?? null,
        previous:
            previous && previous.guildId === event.guildId
                ? previous.revision.participants.map((entry) => ({
                      label: entry.label,
                      score: entry.score,
                  }))
                : null,
        league: snapshot?.success
            ? {
                  fixtureNumber: snapshot.data.fixtureNumber,
                  type: snapshot.data.type,
                  map: snapshot.data.map?.name ?? null,
                  zone: snapshot.data.map?.zone ?? null,
              }
            : null,
    }
}
export const resultsPage = query({
    args: {
        secret: v.string(),
        panelId: v.id("discordPublicPanels"),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        secretGuard(args.secret)
        const panel = await ctx.db.get(args.panelId)
        const guild = panel
            ? await getGuildByDiscordId(ctx, panel.guildId)
            : null
        if (!panel || panel.kind !== "results" || !guild) return null
        const page = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", String(guild._id)))
            .paginate({ cursor: args.cursor, numItems: 100 })
        const events = []
        for (const e of page.page) {
            // Unpublished drafts never reach a public panel.
            if (
                e.isDraft === true ||
                (e.gameId ?? "hell_let_loose") !== panel.gameId
            )
                continue
            const result =
                e.reviewedResultGameId === panel.gameId &&
                e.reviewedResult?.status !== "provisional"
                    ? (e.reviewedResult ?? null)
                    : null
            events.push({
                id: String(e._id),
                name: e.name,
                map: e.map ?? null,
                updatedAt: e.updatedAt ?? e.createdAt,
                result,
                // Added for the result card; older bots ignore it.
                card: result
                    ? await resultCard(ctx, e, result, guild, panel.guildId)
                    : null,
            })
        }
        return {
            cursor: page.isDone ? null : page.continueCursor,
            events,
        }
    },
})
