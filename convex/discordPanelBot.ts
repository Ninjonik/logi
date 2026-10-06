import { v } from "convex/values"

import {
    guildPanel,
    guildPanels,
    panelActionStore,
    panelServerRow,
    panelStatusRecord,
    panelStatusRow,
    purgePanel,
    serverNames,
} from "./discordPanelStore"
import {
    botHeartbeatSchema,
    nextPanelStatus,
    panelAttemptSchema,
} from "../src/domain/discord-publications/panel-delivery"
import {
    runningMatchFor,
    type RunningMatch,
} from "../src/domain/discord-publications/running-match"
import {
    hllLiveWithFreshness,
    readHllLivePayload,
} from "../src/domain/game-data/hll-live-payload"
import type { CompetitionDivisionTable } from "../src/domain/discord-publications/competition-panel"
import {
    internalQuery,
    mutation,
    query,
    type QueryCtx,
} from "./_generated/server"
import { requestPanelAction } from "../src/application/discord-publications/panel-actions"
import { clanBadgeTag } from "../src/domain/discord-publications/panel-graphics-settings"
import { joinPagePlayers } from "../src/domain/discord-publications/server-join"
import { normalizePanelKind } from "../src/domain/discord-publications/settings"
import { deriveDivisionStandings } from "../src/domain/competitions/standings"
import { hllLiveFacts } from "../src/domain/discord-publications/live-panel"
import { projectSnapshot } from "../src/domain/game-data/policy"
import { panelAction } from "./discordPublicationTable"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"
import { connectionSource } from "./gameDataCatalog"
import { getGuildByDiscordId } from "./identity"
import { clanShortCode } from "./clanTeamStore"

/**
 * The bot's side of "Panely v Discordu": the heartbeat, the result of each
 * pass over a panel, removing a panel once its messages are gone, actions
 * from the "Ovládání serveru" message, and the reads a panel needs (clan
 * players, the running match, competition tables, the join page). Every
 * function requires the internal secret.
 */
type Db = Pick<QueryCtx, "db">
const snowflake = /^\d{17,20}$/

/** "Bot online · verze … · poslední kontakt před 12 s" (P1-04..06, P1-B05). */
export const heartbeat = mutation({
    args: {
        secret: v.string(),
        heartbeat: v.object({
            version: v.string(),
            protocol: v.number(),
            startedAt: v.number(),
        }),
        /** Workspaces with panels this bot visited on its last pass. */
        guildIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const beat = botHeartbeatSchema.parse(args.heartbeat)
        const now = Date.now()
        const keys = [
            "bot",
            ...[...new Set(args.guildIds)]
                .filter((id) => snowflake.test(id))
                .slice(0, 200)
                .map((id) => `guild:${id}`),
        ]
        for (const key of keys) {
            const row = await ctx.db
                .query("discordBotHeartbeats")
                .withIndex("key", (q) => q.eq("key", key))
                .unique()
            const value = { ...beat, key, seenAt: now }
            if (row) await ctx.db.patch(row._id, value)
            else await ctx.db.insert("discordBotHeartbeats", value)
        }
    },
})

/** The result of one pass over a panel; feeds the dashboard's state and timeline. */
export const report = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        panelId: v.string(),
        attempt: v.any(),
        /** The admins were just told the channel turned public (P4-30). */
        passwordNotified: v.optional(v.boolean()),
        /** The channel is private again; a later change notifies again. */
        passwordReset: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const attempt = panelAttemptSchema.parse(args.attempt)
        const panel = await guildPanel(ctx, args.guildId, args.panelId)
        if (!panel) return
        const row = await panelStatusRow(ctx, args.panelId)
        const next = nextPanelStatus(panelStatusRecord(row), attempt)
        const notified = args.passwordNotified
            ? attempt.attemptAt
            : args.passwordReset
              ? null
              : (row?.passwordNotifiedAt ?? null)
        const value = {
            ...next,
            guildId: args.guildId,
            panelId: args.panelId,
            passwordNotifiedAt: notified,
        }
        if (row) await ctx.db.patch(row._id, value)
        else await ctx.db.insert("discordPanelStatus", value)
    },
})

/** Deletes a removed panel once the bot took its messages down. */
export const purge = mutation({
    args: { secret: v.string(), guildId: v.string(), panelId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const panel = await guildPanel(ctx, args.guildId, args.panelId)
        if (!panel?.removing) return false
        return await purgePanel(ctx, panel)
    },
})

/**
 * "Obnovit panel" / "Pozastavit panel" / "Pokračovat" from the "Ovládání
 * serveru" message (P5-26..33). The bot checks the admin role freshly on
 * every click before calling this; the panel is the server's live panel.
 */
export const act = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actorId: v.string(),
        action: panelAction,
        panelId: v.optional(v.string()),
        connectionId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (!snowflake.test(args.actorId)) throw new Error("Invalid actor.")
        let panelId = args.panelId ?? null
        if (!panelId && args.connectionId) {
            const panel = (await guildPanels(ctx, args.guildId)).find(
                (row) =>
                    normalizePanelKind(row.kind) === "server" &&
                    row.connectionId === args.connectionId &&
                    !row.removing
            )
            panelId = panel ? String(panel._id) : null
        }
        if (!panelId) return { status: "not_found" as const }
        return await requestPanelAction(panelActionStore(ctx), {
            guildId: args.guildId,
            panelId,
            action: args.action,
            actorId: args.actorId,
            now: Date.now(),
        })
    },
})

/** The calendar panel of a workspace, when it has one (L3-12..18). */
export const calendarPanel = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const panel = (await guildPanels(ctx, args.guildId)).find(
            (row) => row.kind === "calendar"
        )
        if (!panel) return null
        const status = await panelStatusRow(ctx, String(panel._id))
        return {
            ...panel,
            handledRequestAt: status?.handledRequestAt ?? null,
        }
    },
})

/**
 * "Z klanu hraje" (P4-25): which of these live platform IDs belong to a
 * member of this workspace through a verified, active Steam link.
 */
export const clanPlayers = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        platformIds: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const found: string[] = []
        for (const platformId of [...new Set(args.platformIds)].slice(0, 100)) {
            if (!/^\d{17}$/.test(platformId)) continue
            const links = await ctx.db
                .query("platformIdentityLinks")
                .withIndex("platform_platformId_active", (q) =>
                    q
                        .eq("platform", "steam")
                        .eq("platformId", platformId)
                        .eq("active", true)
                )
                .take(5)
            for (const link of links) {
                const member = await ctx.db
                    .query("discordMemberAccess")
                    .withIndex("guildId_userId", (q) =>
                        q
                            .eq("guildId", args.guildId)
                            .eq("userId", link.discordUserId)
                    )
                    .unique()
                if (member) {
                    found.push(platformId)
                    break
                }
            }
        }
        return found
    },
})

/** The Logi match running on a server now, if any (P4-23, L3-35). */
export const runningMatch = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        connectionId: v.string(),
    },
    handler: async (ctx, args): Promise<RunningMatch | null> => {
        assertInternalSecret(args.secret)
        const id = ctx.db.normalizeId("gameDataConnections", args.connectionId)
        const connection = id ? await ctx.db.get(id) : null
        if (!connection || connection.guildId !== args.guildId) return null
        const guild = await getGuildByDiscordId(ctx, args.guildId)
        if (!guild) return null
        const [events, server, names] = await Promise.all([
            ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", String(guild._id)))
                .order("desc")
                .take(200),
            panelServerRow(ctx, args.guildId, args.connectionId),
            serverNames(ctx, args.guildId),
        ])
        return runningMatchFor(
            events.map((event) => ({
                id: String(event._id),
                name: event.name,
                gameId: event.gameId ?? null,
                isDraft: event.isDraft === true,
                server: event.server ?? null,
                gameStart: event.gameStart,
                gameEnd: event.gameEnd,
                matchType: event.matchType ?? null,
                side: event.side ?? null,
                teams: (event.matchTeams ?? []).map((team) => ({
                    slot: team.slot,
                    side: team.side,
                    code: team.snapshot.shortCode ?? team.snapshot.name,
                })),
            })),
            {
                gameId: connection.gameId,
                names: [
                    names.get(args.connectionId) ?? null,
                    connection.observation?.displayName ?? null,
                ],
                address: server?.address ?? null,
                now: Date.now(),
                categoryLabel: (category) =>
                    guild.eventCategories?.find(
                        (item: { id: string; label: string }) =>
                            item.id.toLowerCase() === category.toLowerCase()
                    )?.label ?? null,
            }
        )
    },
})

async function competitionTeam(
    ctx: Db,
    row: Doc<"competitionTeams">,
    guildDiscordId: string
) {
    if (row.teamId) {
        const team = await ctx.db.get(row.teamId)
        return {
            id: String(row.teamId),
            code: team?.shortCode?.trim() || team?.name || "?",
            name: team?.name ?? "?",
            ours: team?.linkedGuildId === guildDiscordId,
        }
    }
    const guild = row.guildId ? await ctx.db.get(row.guildId) : null
    return {
        id: row.guildId ? `guild:${row.guildId}` : String(row._id),
        code: guild?.name ?? "?",
        name: guild?.name ?? "?",
        ours: guild?.discordId === guildDiscordId,
    }
}

/**
 * The competition table panel (L3-19..24): one table per division with ECL
 * cap points, the clan's own team marked, and its next scheduled match.
 */
export const competition = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        competitionId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const id = ctx.db.normalizeId("competitions", args.competitionId)
        const competition = id ? await ctx.db.get(id) : null
        if (!competition || competition.published === false) return null
        const [divisions, registrations, fixtures] = await Promise.all([
            ctx.db
                .query("competitionDivisions")
                .withIndex("competitionId", (q) =>
                    q.eq("competitionId", competition._id)
                )
                .take(20),
            ctx.db
                .query("competitionTeams")
                .withIndex("competitionId", (q) =>
                    q.eq("competitionId", competition._id)
                )
                .take(200),
            ctx.db
                .query("competitionFixtures")
                .withIndex("competitionId", (q) =>
                    q.eq("competitionId", competition._id)
                )
                .take(1000),
        ])
        const teams = new Map(
            await Promise.all(
                registrations.map(
                    async (row) =>
                        [
                            row._id,
                            await competitionTeam(ctx, row, args.guildId),
                        ] as const
                )
            )
        )
        const sideOf = (
            teamId: Id<"teamDirectory"> | undefined,
            guildId: Id<"guilds"> | undefined
        ) => (teamId ? String(teamId) : guildId ? `guild:${guildId}` : "?")
        const now = Date.now()
        const tables: CompetitionDivisionTable[] = divisions
            .sort((a, b) => a.order - b.order)
            .map((division) => {
                const members = registrations.filter(
                    (row) => row.divisionId === division._id && !row.withdrawn
                )
                const views = members.map((row) => teams.get(row._id)!)
                const games = fixtures
                    .filter((row) => row.divisionId === division._id)
                    .map((row) => ({
                        row,
                        teamAId: sideOf(row.sideATeamId, row.teamAId),
                        teamBId: sideOf(row.sideBTeamId, row.teamBId),
                    }))
                const standings = deriveDivisionStandings(
                    views.map((team) => ({ id: team.id, name: team.code })),
                    games.map(({ row, teamAId, teamBId }) => ({
                        id: String(row._id),
                        teamAId,
                        teamBId,
                        scoreA: row.scoreA,
                        scoreB: row.scoreB,
                        status: row.status,
                    }))
                )
                const ours = views.find((team) => team.ours) ?? null
                const finished = games.filter(
                    ({ row }) =>
                        row.phase === "league" &&
                        (row.status === "final" || row.status === "forfeit")
                )
                const round = finished.reduce<number | null>(
                    (max, { row }) =>
                        typeof row.round === "number"
                            ? Math.max(max ?? 0, row.round)
                            : max,
                    null
                )
                const upcoming = ours
                    ? games
                          .filter(
                              ({ row, teamAId, teamBId }) =>
                                  row.status === "scheduled" &&
                                  (teamAId === ours.id ||
                                      teamBId === ours.id) &&
                                  (!row.scheduledAt ||
                                      Date.parse(row.scheduledAt) >= now)
                          )
                          .sort(
                              (a, b) =>
                                  Date.parse(a.row.scheduledAt ?? "9999") -
                                  Date.parse(b.row.scheduledAt ?? "9999")
                          )[0]
                    : undefined
                const code = (teamId: string) =>
                    views.find((team) => team.id === teamId)?.code ?? "?"
                const changedAt = Math.max(
                    0,
                    ...games.map(({ row }) => Date.parse(row.updatedAt) || 0)
                )
                return {
                    divisionId: String(division._id),
                    competition: competition.name.includes(competition.season)
                        ? competition.name
                        : `${competition.name} ${competition.season}`,
                    division: division.name,
                    gameName:
                        competition.gameId === "wardogs"
                            ? "Wardogs"
                            : "Hell Let Loose",
                    rows: standings.map((row) => ({
                        teamId: row.teamId,
                        code: row.name,
                        points: row.capScore,
                        wins: row.totalWins,
                        matches: row.totalMatches,
                        ours: row.teamId === ours?.id,
                    })),
                    round,
                    nextMatch:
                        upcoming && ours
                            ? {
                                  team: ours.code,
                                  title: `${code(upcoming.teamAId)} vs ${code(upcoming.teamBId)}`,
                                  startAt: upcoming.row.scheduledAt ?? null,
                                  round: upcoming.row.round ?? null,
                              }
                            : null,
                    // The bot links the public page in the clan's language.
                    url: null,
                    updatedAt:
                        changedAt || Date.parse(competition.updatedAt) || now,
                }
            })
        return {
            gameId: competition.gameId ?? "hell_let_loose",
            slug: competition.slug,
            tables,
        }
    },
})

/** The HLL server's latest live read, as the server panel last read it. */
async function latestHllLive(
    ctx: QueryCtx,
    connection: Doc<"gameDataConnections">
) {
    if (connection.gameId !== "hell_let_loose") return null
    const cache = await ctx.db
        .query("hllLiveCache")
        .withIndex("connectionId", (q) => q.eq("connectionId", connection._id))
        .unique()
    if (cache?.generation !== connection.generation || !cache.dataJson)
        return null
    // Stored by `hllLiveReads:finish` after validation; the row carries the
    // latest read's times.
    const data = readHllLivePayload(cache.dataJson)
    return data ? hllLiveFacts(hllLiveWithFreshness(data, cache)) : null
}

/**
 * The public join page (`/join/<slug>`, P4-44..46, P4-B10): the server's
 * Logi name, game, address or join code, current players and the queue
 * from the panel's live read. Nothing else, and never a password.
 */
export const joinPage = query({
    args: { secret: v.string(), slug: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (!/^[a-z0-9-]{1,48}$/.test(args.slug)) return null
        const row = await ctx.db
            .query("discordPanelServers")
            .withIndex("slug", (q) => q.eq("slug", args.slug))
            .unique()
        if (!row) return null
        const id = ctx.db.normalizeId("gameDataConnections", row.connectionId)
        const connection = id ? await ctx.db.get(id) : null
        if (!connection || connection.guildId !== row.guildId) return null
        if (!(await connectionSource(ctx, connection))) return null
        const names = await serverNames(ctx, row.guildId)
        const snapshot = connection.enabled
            ? projectSnapshot(
                  { ...connection, id: String(connection._id) },
                  Date.now()
              )
            : null
        const fresh = snapshot && snapshot.freshness !== "unavailable"
        const live = connection.enabled
            ? await latestHllLive(ctx, connection)
            : null
        const now = Date.now()
        const counts = joinPagePlayers({
            snapshot: fresh ? snapshot : null,
            live: live
                ? {
                      fresh: live.freshness === "fresh",
                      at: live.dataAt,
                      players: live.players,
                      capacity: live.capacity,
                      queue: live.queue,
                  }
                : null,
            now,
        })
        return {
            gameId: connection.gameId as "hell_let_loose" | "wardogs",
            name:
                names.get(row.connectionId) ??
                snapshot?.displayName ??
                args.slug,
            address:
                connection.gameId === "hell_let_loose" ? row.address : null,
            joinCode: connection.gameId === "wardogs" ? row.joinCode : null,
            players: counts.players,
            capacity: counts.capacity,
            queue: counts.queue,
        }
    },
})

/**
 * The encrypted password of a panel's server, for the bot's decrypting
 * action only (`discordPanelSecrets:serverPassword`). Internal: never
 * reachable from a client, and only for a live server panel with the
 * password switch on.
 */
export const passwordEnvelope = internalQuery({
    args: { guildId: v.string(), panelId: v.string() },
    handler: async (ctx, args) => {
        const panel = await guildPanel(ctx, args.guildId, args.panelId)
        if (
            !panel ||
            normalizePanelKind(panel.kind) !== "server" ||
            !panel.connectionId ||
            panel.content?.password !== true
        )
            return null
        const server = await panelServerRow(
            ctx,
            args.guildId,
            panel.connectionId
        )
        return server?.password
            ? { connectionId: panel.connectionId, envelope: server.password }
            : null
    },
})

/**
 * What every panel of a workspace is drawn with: the clan language and time
 * zone, the clan's name (header labels) and its message style (colour and
 * icon density).
 */
export const guildContext = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const [config, guild] = await Promise.all([
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique(),
            getGuildByDiscordId(ctx, args.guildId),
        ])
        return {
            language: config?.defaultLanguage ?? "en",
            timeZone: config?.timezone ?? "Europe/Prague",
            clanName: guild?.name ?? null,
            // P7-13, P8-07: the same badge as the P8 preview.
            clanTag: clanBadgeTag(
                guild?.name ?? "",
                await clanShortCode(ctx, args.guildId)
            ),
            messageStyle: config?.messageStyle ?? null,
            eventCategories: (guild?.eventCategories ?? []).map(
                (category: { id: string; label: string }) => ({
                    id: category.id,
                    label: category.label,
                })
            ),
        }
    },
})
