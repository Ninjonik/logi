import {
    seedPublicationKey,
    seedPublicationKeyPrefix,
} from "../src/domain/discord-seed/publication-keys"
import { publicationsWithPrefix } from "./discordPublications"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import {
    guildPanel,
    guildPanels,
    panelActionStore,
    panelOwnsKey,
    panelPublications,
    panelSaveStore,
    panelServerInfos,
    panelServerRow,
    panelStatusRecord,
    serverNames,
    sourceHealth,
    storedPanel,
    storedPublication,
} from "./discordPanelStore"
import {
    joinCodeSchema,
    serverAddressSchema,
    serverJoinUrl,
    uniqueServerJoinSlug,
} from "../src/domain/discord-publications/server-join"
import {
    DEFAULT_PANEL_CONTENT,
    isPanelPaused,
    panelSaveSchema,
    resolvePanelContent,
} from "../src/domain/discord-publications/settings"
import {
    buildPanelOverview,
    type PanelOverview,
    type StoredControlMessage,
} from "../src/application/discord-publications/panel-overview"
import {
    requestPanelAction,
    type PanelActionResult,
} from "../src/application/discord-publications/panel-actions"
import {
    testPanelFetch,
    type PanelTestResult,
} from "../src/application/discord-publications/test-fetch"
import {
    liveServerPanelView,
    type LiveServerFacts,
} from "../src/domain/discord-publications/live-panel"
import {
    action,
    internalQuery,
    mutation,
    query,
    type QueryCtx,
} from "./_generated/server"
import {
    resolvePanelStyle,
    type PanelStyle,
} from "../src/domain/discord-publications/panel-graphics"
import {
    savePanel,
    type PanelSaveResult,
} from "../src/application/discord-publications/save-panel"
import {
    leagueOverviewSchema,
    type LeagueOverview,
} from "../src/domain/wardogs-league/panels"
import { resolvePanelPresentation } from "../src/domain/discord-publications/panel-presentation"
import { convexLeaguePanelSource } from "../src/infrastructure/convex/league-fixture-store"
import { loadLeaguePanels } from "../src/application/wardogs-league/league-panels"
import type { MessageView } from "../src/domain/discord-messages/message-view"
import { credentialEnvelopeSchema } from "../src/domain/game-data/credentials"
import type { WarconServed } from "../src/application/game-data/read-warcon"
import type { HllServed } from "../src/application/game-data/read-hll-live"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { PANEL_WINDOW } from "../src/domain/wardogs-league/all-fixtures"
import type { ServerSnapshot } from "../src/domain/game-data/contracts"
import { getPanelMessages } from "../src/lib/clan-language/panels"
import { projectSnapshot } from "../src/domain/game-data/policy"
import { installedPanelEmoji } from "./discordPanelGraphics"
import { panelAction } from "./discordPublicationTable"
import { trackingConfig } from "./leagueTrackingStore"
import { seedMessageOutbox } from "./discordSeedStore"
import { connectionSource } from "./gameDataCatalog"
import { getGuildByDiscordId } from "./identity"

/**
 * "Panely v Discordu" for the dashboard (P1, P2): the overview with states,
 * timing, errors and the bot heartbeat; saving a panel; the live actions;
 * the per-server join details and encrypted password; and the test read.
 * Every function re-checks the dashboard session and the clan-admin right;
 * the actor comes from the session, never from the browser. Discord itself
 * is touched only by the bot, which answers the requests on its next pass.
 */
const dashboardArgs = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}

async function botHeartbeats(ctx: Pick<QueryCtx, "db">, guildId: string) {
    const [bot, guild] = await Promise.all(
        ["bot", `guild:${guildId}`].map((key) =>
            ctx.db
                .query("discordBotHeartbeats")
                .withIndex("key", (q) => q.eq("key", key))
                .unique()
        )
    )
    return { bot: bot ?? null, guild: guild ?? null }
}

/**
 * "Ovládání serveru" of every server with a control channel (P1-18): the
 * seed plan names the channel, the seed worker's managed message its state.
 */
async function controlMessages(
    ctx: Pick<QueryCtx, "db">,
    guildId: string
): Promise<StoredControlMessage[]> {
    const [plans, messages, publications] = await Promise.all([
        ctx.db
            .query("discordSeedPlans")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("discordSeedMessages")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        publicationsWithPrefix(
            ctx,
            guildId,
            seedPublicationKeyPrefix("control")
        ),
    ])
    return plans.map((plan) => {
        // The outbox row counts the requests; the bot delivers the message
        // through the managed publication `seed:control:<connectionId>`.
        const row = messages.find(
            (message) =>
                message.kind === "control" && message.key === plan.connectionId
        )
        const key = seedPublicationKey("control", plan.connectionId)
        const publication = publications.find((entry) => entry.key === key)
        return {
            connectionId: plan.connectionId,
            channelId: plan.settings.controlChannelId,
            message:
                row || publication
                    ? {
                          channelId:
                              publication?.channelId ?? row?.channelId ?? null,
                          messageId:
                              publication?.messageId ?? row?.messageId ?? null,
                          revision: row?.revision ?? 0,
                          deliveredRevision: row?.deliveredRevision ?? 0,
                          lastSuccessAt:
                              publication?.lastSuccessAt ??
                              row?.lastSuccessAt ??
                              null,
                          error: publication?.error ?? row?.error ?? null,
                          pending:
                              Boolean(publication?.pending) ||
                              (row?.pending ?? null) !== null,
                      }
                    : null,
        }
    })
}

/** Names of the admins who saved or paused panels ("Uloženo · Hráč 01", P1-22, P2-31). */
async function panelPeople(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    ids: Iterable<string | null | undefined>
) {
    const people: Record<string, string> = {}
    for (const id of new Set(
        [...ids].filter((value): value is string => Boolean(value))
    )) {
        if (Object.keys(people).length >= 50) break
        const user = await ctx.db
            .query("users")
            .withIndex("discordId", (q) => q.eq("discordId", id))
            .first()
        const name = user?.nicknames?.[guildId]?.trim() || user?.name?.trim()
        if (name) people[id] = name
    }
    return people
}

export type PanelOverviewResponse = PanelOverview & {
    /** The bot visited this server in the last 3 minutes; null when unknown. */
    botInServer: boolean | null
}

export const overview = query({
    args: dashboardArgs,
    handler: async (ctx, args): Promise<PanelOverviewResponse> => {
        await authorizeDashboardAdmin(ctx, args)
        const now = Date.now()
        const [
            panels,
            publications,
            statuses,
            beats,
            sources,
            servers,
            controls,
        ] = await Promise.all([
            guildPanels(ctx, args.guildId),
            panelPublications(ctx, args.guildId),
            ctx.db
                .query("discordPanelStatus")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect(),
            botHeartbeats(ctx, args.guildId),
            sourceHealth(ctx, args.guildId, now),
            panelServerInfos(ctx, args.guildId),
            controlMessages(ctx, args.guildId),
        ])
        const emoji = await installedPanelEmoji(ctx)
        const people = await panelPeople(
            ctx,
            args.guildId,
            panels.flatMap((panel) => [panel.savedBy, panel.pausedBy])
        )
        const graphics = await ctx.db
            .query("discordPanelGraphics")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        const view = buildPanelOverview({
            now,
            heartbeat: beats.bot,
            defaultStyle: (graphics?.defaultStyle as PanelStyle) ?? "a",
            panels: panels.map((panel) => ({
                panel: storedPanel(panel),
                status: panelStatusRecord(
                    statuses.find((row) => row.panelId === String(panel._id)) ??
                        null
                ),
                publications: publications
                    .filter((row) => panelOwnsKey(panel, row.key))
                    .map(storedPublication),
            })),
            sources,
            servers,
            controls,
            people,
            emoji,
        })
        return {
            ...view,
            botInServer:
                view.bot.state === "unknown" || !panels.length
                    ? null
                    : Boolean(
                          beats.guild && now - beats.guild.seenAt < 3 * 60_000
                      ),
        }
    },
})

/** "Uložit" and "Uložit a odeslat" of the editor (P2-34, P2-49). */
export const save = mutation({
    args: {
        ...dashboardArgs,
        panelId: v.union(v.string(), v.null()),
        settings: v.any(),
        send: v.boolean(),
        expectedRevision: v.union(v.number(), v.null()),
    },
    handler: async (ctx, args): Promise<PanelSaveResult> => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        return await savePanel(panelSaveStore(ctx), {
            guildId: args.guildId,
            panelId: args.panelId,
            settings: panelSaveSchema.parse(args.settings),
            send: args.send,
            expectedRevision: args.expectedRevision,
            actorId: admin.session.subject,
            now: Date.now(),
        })
    },
})

/** Odeslat do kanálu, Obnovit teď, Pozastavit / Spustit, Zkusit znovu, Odstranit zprávu, remove. */
export const act = mutation({
    args: { ...dashboardArgs, panelId: v.string(), action: panelAction },
    handler: async (ctx, args): Promise<PanelActionResult> => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        return await requestPanelAction(panelActionStore(ctx), {
            guildId: args.guildId,
            panelId: args.panelId,
            action: args.action,
            actorId: admin.session.subject,
            now: Date.now(),
        })
    },
})

const envelope = v.object({
    format: v.literal(1),
    keyId: v.string(),
    nonce: v.string(),
    ciphertext: v.string(),
    tag: v.string(),
})

export type PanelServerSaveResult =
    | { status: "saved"; slug: string; joinUrl: string | null }
    | { status: "not_found" }
    | { status: "invalid"; field: "address" | "joinCode" | "password" }

/**
 * Join details of one server (P2-15, P2-39, P2-40): the address or join code
 * and the server password. The password arrives already encrypted by the web
 * server (AES-256-GCM, operator keyring); `null` removes it, absent keeps it.
 */
export const setServer = mutation({
    args: {
        ...dashboardArgs,
        connectionId: v.string(),
        address: v.optional(v.union(v.string(), v.null())),
        joinCode: v.optional(v.union(v.string(), v.null())),
        password: v.optional(v.union(envelope, v.null())),
    },
    handler: async (ctx, args): Promise<PanelServerSaveResult> => {
        await authorizeDashboardAdmin(ctx, args)
        const id = ctx.db.normalizeId("gameDataConnections", args.connectionId)
        const connection = id ? await ctx.db.get(id) : null
        if (
            !connection ||
            connection.guildId !== args.guildId ||
            !(await connectionSource(ctx, connection))
        )
            return { status: "not_found" }
        const clean = <T extends string>(
            value: string | null | undefined,
            schema: { safeParse(value: string): { success: boolean; data?: T } }
        ): { ok: true; value: T | null | undefined } | { ok: false } => {
            if (value === undefined) return { ok: true, value: undefined }
            if (value === null || !value.trim())
                return { ok: true, value: null }
            const parsed = schema.safeParse(value)
            return parsed.success
                ? { ok: true, value: parsed.data ?? null }
                : { ok: false }
        }
        const address = clean<string>(args.address, serverAddressSchema)
        if (!address.ok) return { status: "invalid", field: "address" }
        const joinCode = clean<string>(args.joinCode, joinCodeSchema)
        if (!joinCode.ok) return { status: "invalid", field: "joinCode" }
        if (
            args.password &&
            !credentialEnvelopeSchema.safeParse(args.password).success
        )
            return { status: "invalid", field: "password" }
        const now = Date.now()
        const existing = await panelServerRow(
            ctx,
            args.guildId,
            args.connectionId
        )
        const patch = {
            ...(address.value !== undefined ? { address: address.value } : {}),
            ...(joinCode.value !== undefined
                ? { joinCode: joinCode.value }
                : {}),
            ...(args.password !== undefined
                ? {
                      password: args.password,
                      passwordUpdatedAt: args.password ? now : null,
                  }
                : {}),
            updatedAt: now,
        }
        let slug: string
        if (existing) {
            await ctx.db.patch(existing._id, patch)
            slug = existing.slug
        } else {
            const name =
                (await serverNames(ctx, args.guildId)).get(args.connectionId) ??
                "server"
            const taken = new Set(
                (await ctx.db.query("discordPanelServers").take(5000)).map(
                    (row) => row.slug
                )
            )
            slug = uniqueServerJoinSlug(name, (value) => taken.has(value))
            await ctx.db.insert("discordPanelServers", {
                guildId: args.guildId,
                connectionId: args.connectionId,
                slug,
                address: null,
                joinCode: null,
                password: null,
                passwordUpdatedAt: null,
                ...patch,
            })
        }
        const site = process.env.SITE_URL
        return {
            status: "saved",
            slug,
            joinUrl: site ? serverJoinUrl(site, slug) : null,
        }
    },
})

/** What the test read needs, after the admin check (internal). */
export const testContext = internalQuery({
    args: {
        ...dashboardArgs,
        connectionId: v.string(),
        panelId: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const id = ctx.db.normalizeId("gameDataConnections", args.connectionId)
        const connection = id ? await ctx.db.get(id) : null
        if (!connection || connection.guildId !== args.guildId) return null
        const usable = Boolean(await connectionSource(ctx, connection))
        const now = Date.now()
        const snapshot: ServerSnapshot | null =
            usable && connection.enabled
                ? projectSnapshot(
                      { ...connection, id: String(connection._id) },
                      now
                  )
                : null
        const panel = args.panelId
            ? await guildPanel(ctx, args.guildId, args.panelId)
            : null
        const [config, guild, server, graphics, names] = await Promise.all([
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique(),
            getGuildByDiscordId(ctx, args.guildId),
            panelServerRow(ctx, args.guildId, args.connectionId),
            ctx.db
                .query("discordPanelGraphics")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique(),
            serverNames(ctx, args.guildId),
        ])
        const site = process.env.SITE_URL
        return {
            provider: connection.provider,
            usable,
            collecting: connection.enabled,
            snapshot,
            language: config?.defaultLanguage ?? "en",
            timeZone: config?.timezone ?? "Europe/Prague",
            clanName: guild?.name ?? null,
            serverName: names.get(String(connection._id)) ?? null,
            defaultStyle: (graphics?.defaultStyle as PanelStyle) ?? "a",
            panel: panel ? storedPanel(panel) : null,
            server: server
                ? {
                      address: server.address,
                      joinCode: server.joinCode,
                      joinUrl: site ? serverJoinUrl(site, server.slug) : null,
                  }
                : null,
        }
    },
})

export type PanelTestResponse =
    | { status: "not_found" }
    | (Omit<PanelTestResult, "facts"> & {
          collecting: boolean
          /** The panel as the bot would draw it now, without a password. */
          preview: MessageView | null
          /**
           * The facts the preview is drawn from, so the editor redraws it
           * with unsaved settings (P2-B09). Player platform IDs are removed.
           */
          facts: LiveServerFacts | null
          /** The clan's time zone, for the style A image's time stamp. */
          timeZone: string
      })

/**
 * "Načíst data ze serveru" (P2-29, P2-B10): runs the bot's live read with
 * the admin's session (CRCON or Warcon) and returns the provider status, a
 * summary and the rendered preview. No key, address or password.
 */
export const testFetch = action({
    args: {
        ...dashboardArgs,
        connectionId: v.string(),
        panelId: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args): Promise<PanelTestResponse> => {
        const context = await ctx.runQuery(
            makeFunctionReference<"query">("discordPanels:testContext"),
            { ...args, panelId: args.panelId ?? null }
        )
        if (!context) return { status: "not_found" }
        const access = {
            secret: args.secret,
            guildId: args.guildId,
            connectionId: args.connectionId,
            actor: args.actor,
        }
        const now = Date.now()
        const result = await testPanelFetch(
            {
                provider: context.usable ? context.provider : "unusable",
                snapshot: context.snapshot,
                now,
            },
            {
                readHll: () =>
                    ctx.runAction(
                        makeFunctionReference<
                            "action",
                            typeof access,
                            HllServed
                        >("hllLiveData:read"),
                        access
                    ),
                readWarcon: () =>
                    ctx.runAction(
                        makeFunctionReference<
                            "action",
                            typeof access & { queryJson: string },
                            WarconServed
                        >("warconData:read"),
                        { ...access, queryJson: '{"view":"live"}' }
                    ),
            }
        )
        const { facts, ...rest } = result
        const panel = context.panel
        const copy = getPanelMessages(context.language)
        const preview = facts
            ? liveServerPanelView({
                  copy: copy.live,
                  language: context.language,
                  panel: {
                      id: panel?.id ?? "preview",
                      revision: panel?.revision ?? 0,
                      title: panel?.title ?? context.serverName,
                      description: panel?.description ?? null,
                      showPlayers: panel?.showPlayers ?? true,
                      showLeaders: panel?.showLeaders ?? true,
                      reportEnabled: Boolean(panel?.reportCategoryId),
                      layout: resolvePanelPresentation(panel).layout,
                      content: panel
                          ? resolvePanelContent(panel.content)
                          : DEFAULT_PANEL_CONTENT,
                      accentColor: resolvePanelPresentation(panel).accentColor,
                      style: resolvePanelStyle(
                          {
                              presentation: {
                                  style: panel?.presentation?.style ?? null,
                              },
                          },
                          context.defaultStyle
                      ),
                  },
                  facts,
                  now,
                  paused: panel ? isPanelPaused(panel) : false,
                  privateChannel: false,
                  seed: null,
                  seedChannelId: null,
                  liveFrom: 40,
                  match: null,
                  clanPlayers: null,
                  server: {
                      address: context.server?.address ?? null,
                      joinCode: context.server?.joinCode ?? null,
                      password: null,
                      joinUrl: context.server?.joinUrl ?? null,
                  },
                  newMap: false,
                  emoji: {},
                  images: { score: null, banner: null, thumbnail: null },
                  ids: {
                      players: "preview:players",
                      report: "preview:report",
                  },
              })
            : null
        return {
            ...rest,
            collecting: context.collecting,
            preview,
            facts: facts
                ? {
                      ...facts,
                      roster: facts.roster.map((player) => ({
                          ...player,
                          id: null,
                      })),
                  }
                : null,
            timeZone: context.timeZone,
        }
    },
})

/**
 * The two WD League messages with the League's current data, for the
 * editor preview (P2-54, P2-55). Shared League data; the clan's watched
 * team codes mark its own team.
 */
export const leaguePreview = query({
    args: { ...dashboardArgs, fixtureCount: v.number() },
    handler: async (ctx, args): Promise<LeagueOverview> => {
        await authorizeDashboardAdmin(ctx, args)
        const fixtureCount = Math.min(
            PANEL_WINDOW,
            Math.max(1, Math.trunc(args.fixtureCount) || 1)
        )
        const config = await trackingConfig(ctx, args.guildId)
        const now = Date.now()
        const panels = await loadLeaguePanels(
            convexLeaguePanelSource(ctx, now),
            {
                now,
                ourTeamCodes: config?.teamCodes ?? [],
                options: {
                    table: true,
                    fixtures: true,
                    recentResults: true,
                    fixtureCount,
                },
            }
        )
        return leagueOverviewSchema.parse(panels)
    },
})

/**
 * "Obnovit teď" on an "Ovládání serveru" row (P1-18): asks the seed worker
 * to draw the server's control message again on its next pass.
 */
export const refreshControl = mutation({
    args: { ...dashboardArgs, connectionId: v.string() },
    handler: async (
        ctx,
        args
    ): Promise<{ status: "accepted" } | { status: "not_found" }> => {
        await authorizeDashboardAdmin(ctx, args)
        const plan = (
            await ctx.db
                .query("discordSeedPlans")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect()
        ).find((row) => row.connectionId === args.connectionId)
        if (!plan?.settings.controlChannelId) return { status: "not_found" }
        await seedMessageOutbox(ctx, () => Date.now()).controlChanged({
            guildId: args.guildId,
            connectionId: args.connectionId,
        })
        return { status: "accepted" }
    },
})
