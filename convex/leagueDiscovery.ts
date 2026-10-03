import {
    ensureTracked,
    trackedMatch,
    trackingConfig,
    trackingAdmission,
    updateTracked,
} from "./leagueTrackingStore"
import {
    trackingSettingsSchema,
    DEFAULT_TRACKING_SETTINGS,
    MAX_TRACKED,
} from "../src/domain/wardogs-league/discovery"
import { acceptMessageVersion } from "../src/application/wardogs-league/intake-policy"
import { trackingDecision } from "../src/application/wardogs-league/tracking"
import { leagueSnapshotSchema } from "../src/domain/wardogs-league/contracts"
import { projectLeagueFixture } from "../src/domain/wardogs-league/fixture"
import { dashboardActor, authorizeDashboardAdmin } from "./dashboardActor"
import { matchUrl } from "../src/domain/wardogs-league/match-url"
import { assertSessionGateway } from "./dashboardSessionStore"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
const settingsFields = {
    enabled: v.boolean(),
    teamCodes: v.array(v.string()),
    inputChannelId: v.union(v.string(), v.null()),
    outputChannelId: v.union(v.string(), v.null()),
}
export const configure = mutation({
    args: {
        ...access,
        settings: v.object(settingsFields),
        verifiedChannels: v.array(
            v.object({
                id: v.string(),
                guildId: v.string(),
                type: v.number(),
                canPublish: v.boolean(),
            })
        ),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const settings = trackingSettingsSchema.parse(args.settings)
        for (const id of [
            settings.inputChannelId,
            settings.outputChannelId,
        ].filter(Boolean)) {
            const channel = args.verifiedChannels.find((c) => c.id === id)
            if (
                settings.enabled &&
                (!channel ||
                    channel.guildId !== args.guildId ||
                    ![0, 5].includes(channel.type) ||
                    !channel.canPublish)
            )
                throw new Error("Channel access unavailable.")
        }
        const old = await trackingConfig(ctx, args.guildId),
            now = Date.now()
        const value = {
            ...settings,
            guildId: args.guildId,
            revision: Math.max(now, (old?.revision ?? 0) + 1),
            lastIndexAt: undefined,
            queueFull: false,
        }
        if (old) await ctx.db.patch(old._id, value)
        else {
            if (
                (await ctx.db.query("leagueTrackingSettings").take(101))
                    .length >= 100
            )
                throw new Error("Workspace tracking limit reached.")
            await ctx.db.insert("leagueTrackingSettings", value)
        }
        // Invalidate old work immediately; only current settings determine eligibility.
        const rows = await ctx.db
            .query("leagueTrackedMatches")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(MAX_TRACKED)
        for (const row of rows) {
            const snapshot = row.snapshotJson
                ? leagueSnapshotSchema.parse(JSON.parse(row.snapshotJson))
                : null
            const decision = snapshot
                ? trackingDecision(row, snapshot, settings.teamCodes, now)
                : {
                      state: row.ignored
                          ? ("ignored" as const)
                          : row.paused
                            ? ("paused" as const)
                            : ("pending" as const),
                  }
            await updateTracked(ctx, row, {
                ...decision,
                ...(!settings.enabled && !row.ignored
                    ? { state: "paused" as const }
                    : {}),
                leaseUntil: 0,
                fence: row.fence + 1,
                nextRefreshAt: now,
            })
        }
        return { ok: true }
    },
})
export const list = query({
    args: access,
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const config = await trackingConfig(ctx, args.guildId)
        const records = await ctx.db
            .query("leagueTrackedMatches")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(MAX_TRACKED)
        const scan = await ctx.db
            .query("leagueIndexCache")
            .withIndex("key", (q) => q.eq("key", "indexes"))
            .unique()
        return {
            settings: config
                ? {
                      enabled: config.enabled,
                      teamCodes: config.teamCodes,
                      inputChannelId: config.inputChannelId,
                      outputChannelId: config.outputChannelId,
                  }
                : DEFAULT_TRACKING_SETTINGS,
            scan: scan
                ? {
                      fetchedAt: scan.fetchedAt ?? null,
                      lastAttemptAt: scan.lastAttemptAt ?? null,
                      nextScanAt: scan.nextScanAt,
                      error: scan.error ?? null,
                      incomplete: scan.incomplete,
                      queueFull: config?.queueFull ?? false,
                  }
                : null,
            records: records
                .filter(
                    (r) =>
                        r.tracked ||
                        r.pinned ||
                        r.ignored ||
                        r.discordRefs.length > 0
                )
                .map((r) => ({
                    id: r.matchId,
                    state: r.state,
                    pinned: r.pinned,
                    ignored: r.ignored,
                    paused: r.paused,
                    eventId: r.eventId ?? null,
                    fixture: projectLeagueFixture(r, Date.now()),
                    error: r.error ?? null,
                })),
        }
    },
})
export const manage = mutation({
    args: {
        ...access,
        sourceUrl: v.string(),
        operation: v.union(
            v.literal("add"),
            v.literal("pause"),
            v.literal("resume"),
            v.literal("ignore"),
            v.literal("link")
        ),
        eventId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const auth = await authorizeDashboardAdmin(ctx, args),
            source = matchUrl(args.sourceUrl)
        const config = await trackingConfig(ctx, args.guildId)
        if (!config) throw new Error("Save tracking settings first.")
        const row =
            args.operation === "add"
                ? await ensureTracked(ctx, args.guildId, source.id)
                : await trackedMatch(ctx, args.guildId, source.id)
        if (!row) throw new Error("Match not found.")
        const patch: Partial<typeof row> = {
            leaseUntil: 0,
            fence: row.fence + 1,
        }
        if (args.operation === "add" || args.operation === "resume") {
            Object.assign(patch, {
                pinned: true,
                intakeReserved: false,
                manualRefresh: true,
                ignored: false,
                paused: false,
                state: "pending",
                nextRefreshAt: Date.now(),
            })
            if (row.snapshotJson) {
                const { tracked, automatic, announce } = trackingDecision(
                    { ...row, ...patch },
                    leagueSnapshotSchema.parse(JSON.parse(row.snapshotJson)),
                    config.teamCodes,
                    Date.now()
                )
                Object.assign(patch, { tracked, automatic, announce })
            }
        }
        if (args.operation === "pause")
            Object.assign(patch, { paused: true, state: "paused" })
        if (args.operation === "ignore")
            Object.assign(patch, {
                ignored: true,
                intakeReserved: false,
                tracked: false,
                announce: false,
                state: "ignored",
            })
        if (args.operation === "link") {
            if (args.eventId) {
                const id = ctx.db.normalizeId("events", args.eventId),
                    event = id ? await ctx.db.get(id) : null
                if (
                    !event ||
                    ![String(auth.server._id), args.guildId].includes(
                        event.guildId
                    ) ||
                    event.gameId !== "wardogs" ||
                    (event.kind ?? "match") !== "match"
                )
                    throw new Error(
                        "Event not available in this workspace/game."
                    )
                const existing = await ctx.db
                    .query("leagueTrackedMatches")
                    .withIndex("event", (q) =>
                        q.eq("guildId", args.guildId).eq("eventId", String(id))
                    )
                    .unique()
                if (existing && existing._id !== row._id)
                    throw new Error("Event already linked.")
                patch.eventId = String(id)
            } else patch.eventId = undefined
        }
        await updateTracked(ctx, row, patch)
        return { id: source.id }
    },
})
export const forGuild = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const settings = await trackingConfig(ctx, args.guildId)
        if (!settings) return null
        const records = await ctx.db
            .query("leagueTrackedMatches")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(MAX_TRACKED)
        const publications = await ctx.db
            .query("discordPublications")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        const published = new Set(
            publications
                .filter(
                    (p) =>
                        p.key.startsWith("league:") &&
                        (p.messageId || p.pending)
                )
                .map((p) => p.key)
        )
        return {
            settings,
            records: records
                .filter(
                    (row) => row.tracked || published.has(`league:${row._id}`)
                )
                .map((row) => ({
                    id: String(row._id),
                    revision: Math.max(settings.revision, row.revision),
                    channelId:
                        settings.enabled && row.tracked && row.announce
                            ? settings.outputChannelId
                            : null,
                    fixture: projectLeagueFixture(row, Date.now()),
                })),
        }
    },
})
export const inputSettings = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const settings = await trackingConfig(ctx, args.guildId)
        return settings
            ? {
                  enabled: settings.enabled,
                  inputChannelId: settings.inputChannelId,
              }
            : null
    },
})
export const ingestMessage = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        channelId: v.string(),
        messageId: v.string(),
        urls: v.array(v.string()),
        human: v.boolean(),
        version: v.number(),
        deleted: v.boolean(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        if (
            !args.human ||
            args.urls.length > 3 ||
            !/^\d{17,20}$/.test(args.messageId)
        )
            return
        const config = await trackingConfig(ctx, args.guildId)
        const old = await ctx.db
            .query("leagueMessageRefs")
            .withIndex("identity", (q) =>
                q.eq("guildId", args.guildId).eq("messageId", args.messageId)
            )
            .unique()
        if (!acceptMessageVersion(old, args.version, args.deleted)) return
        if (!config || (old && old.channelId !== args.channelId)) return
        const admitsNew =
            config.enabled && config.inputChannelId === args.channelId
        if (!admitsNew && !old) return
        let ids = [...new Set(args.urls.map((url) => matchUrl(url).id))]
        if (args.deleted && ids.length) return
        // Received edits/deletes may remove known references even when intake is
        // disabled or moved. They must never register new IDs through the old room.
        if (!admitsNew) ids = ids.filter((id) => old!.matchIds.includes(id))
        if (!old && !ids.length) return
        const now = Date.now()
        if (ids.length) {
            const windowAt =
                (config.intakeWindowAt ?? 0) + 60_000 > now
                    ? config.intakeWindowAt!
                    : now
            const count =
                windowAt === config.intakeWindowAt
                    ? (config.intakeCount ?? 0)
                    : 0
            if (count >= 20)
                ids = ids.filter((id) => old?.matchIds.includes(id))
            if (
                !old &&
                (
                    await ctx.db
                        .query("leagueMessageRefs")
                        .withIndex("guildId", (q) =>
                            q.eq("guildId", args.guildId)
                        )
                        .take(2000)
                ).length >= 2000
            )
                return
            if (count < 20)
                await ctx.db.patch(config._id, {
                    intakeWindowAt: windowAt,
                    intakeCount: count + 1,
                })
        }
        const pool = await trackingAdmission(ctx, args.guildId)
        const acceptedIds: string[] = []
        for (const id of new Set([...(old?.matchIds ?? []), ...ids])) {
            const admitted = ids.includes(id)
                ? await pool.admit(id, "discord")
                : null
            const row = admitted ?? pool.find(id)
            if (!row) continue
            const refs = row.discordRefs.filter(
                (r) => r.messageId !== args.messageId
            )
            if (admitted && refs.length < 20) {
                refs.push({
                    channelId: args.channelId,
                    messageId: args.messageId,
                })
                acceptedIds.push(id)
            }
            const updated = { ...row, discordRefs: refs }
            const snapshot = row.snapshotJson
                ? leagueSnapshotSchema.parse(JSON.parse(row.snapshotJson))
                : null
            const decision = snapshot
                ? trackingDecision(
                      updated,
                      snapshot,
                      config.teamCodes,
                      Date.now()
                  )
                : {
                      state: row.ignored
                          ? ("ignored" as const)
                          : row.paused
                            ? ("paused" as const)
                            : updated.pinned || refs.length
                              ? ("pending" as const)
                              : ("unmatched" as const),
                  }
            await updateTracked(ctx, row, {
                ...decision,
                ...(!config.enabled && !row.ignored
                    ? { state: "paused" as const }
                    : {}),
                discordRefs: refs,
                leaseUntil: 0,
                fence: row.fence + 1,
                nextRefreshAt: Date.now(),
            })
        }
        if (old) {
            await ctx.db.patch(old._id, {
                matchIds: acceptedIds,
                version: args.version,
                deleted: args.deleted,
                expiresAt: acceptedIds.length ? undefined : now + 7 * 86400_000,
            })
        } else if (acceptedIds.length)
            await ctx.db.insert("leagueMessageRefs", {
                guildId: args.guildId,
                messageId: args.messageId,
                channelId: args.channelId,
                matchIds: acceptedIds,
                version: args.version,
                deleted: false,
            })
    },
})
