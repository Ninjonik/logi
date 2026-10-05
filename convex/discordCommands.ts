import { v } from "convex/values"

import {
    storedCommandSettingsSchema,
    type StoredCommandSettings,
} from "../src/domain/discord-commands/command-settings"
import { guildCommandConfigFromStored } from "../src/domain/discord-commands/guild-config"
import { statsCommandSettingsSchema } from "../src/domain/player-stats/command-settings"
import { assertInternalSecret, statsSettingsValidator } from "./discord_shared"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { commandSettingsValidator } from "./discordCommandTable"
import { getGuildByDiscordId } from "./identity"

/**
 * Slash commands of the Discord redesign (boards M1 and N3): the bot reads
 * every server's command settings through one live query, registers the
 * commands and records each registration; the "Příkazy" page saves the
 * settings and asks for a new registration through the authenticated web
 * gateway, which re-checks the dashboard session and the clan-admin right in
 * the same transaction.
 */

/** A "Znovu zaregistrovat" click within this window keeps the earlier request. */
const REQUEST_DEBOUNCE_MS = 10_000

async function registrationOf(ctx: Pick<QueryCtx, "db">, guildId: string) {
    return await ctx.db
        .query("discordCommandRegistrations")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}

/**
 * Every configured server's command settings for the bot (internal secret).
 * The bot watches it, so a language change, saved settings or a
 * re-registration request reaches it within seconds.
 */
export const listGuildConfigs = query({
    args: { secret: v.string() },
    handler: async (ctx, { secret }) => {
        assertInternalSecret(secret)
        const [configs, registrations] = await Promise.all([
            ctx.db.query("discordConfigs").collect(),
            ctx.db.query("discordCommandRegistrations").collect(),
        ])
        const byGuild = new Map(
            registrations.map((row) => [row.guildId, row] as const)
        )
        return await Promise.all(
            configs.map(async (config) => {
                const panels = await ctx.db
                    .query("discordPublicPanels")
                    .withIndex("guildId", (q) =>
                        q.eq("guildId", config.guildId)
                    )
                    .collect()
                return guildCommandConfigFromStored({
                    config,
                    registration: byGuild.get(config.guildId) ?? null,
                    panels,
                })
            })
        )
    },
})

/** The Logi workspace of a Discord server, for links into the dashboard. */
export const workspaceOf = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, { secret, guildId }) => {
        assertInternalSecret(secret)
        const guild = await getGuildByDiscordId(ctx, guildId)
        return guild
            ? { workspaceId: String(guild._id), name: guild.name }
            : null
    },
})

/**
 * The bot records a registration: on success the time, count, language and
 * the definitions' signature, and it answers a pending request it covered;
 * on failure only a category.
 */
export const recordRegistration = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        at: v.number(),
        /** The request time the bot saw when it started; cleared if still current. */
        handledRequestAt: v.optional(v.number()),
        result: v.union(
            v.object({
                ok: v.literal(true),
                commandCount: v.number(),
                language: v.string(),
                signature: v.string(),
            }),
            v.object({
                ok: v.literal(false),
                failure: v.union(
                    v.literal("forbidden"),
                    v.literal("rate_limited"),
                    v.literal("unavailable")
                ),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const existing = await registrationOf(ctx, args.guildId)
        const requestHandled =
            existing?.requestedAt !== undefined &&
            args.handledRequestAt !== undefined &&
            existing.requestedAt <= args.handledRequestAt
        const fields = args.result.ok
            ? {
                  registeredAt: args.at,
                  commandCount: args.result.commandCount,
                  language: args.result.language,
                  signature: args.result.signature,
                  failedAt: undefined,
                  failure: undefined,
              }
            : { failedAt: args.at, failure: args.result.failure }
        const patch = {
            ...fields,
            ...(requestHandled ? { requestedAt: undefined } : {}),
            updatedAt: Date.now(),
        }
        if (existing) await ctx.db.patch(existing._id, patch)
        else
            await ctx.db.insert("discordCommandRegistrations", {
                guildId: args.guildId,
                ...patch,
            })
        return { ok: true }
    },
})

const dashboardArgs = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}

/** What the "Registrace příkazů" card shows (N3-03). */
export const registrationForDashboard = query({
    args: dashboardArgs,
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const row = await registrationOf(ctx, args.guildId)
        return {
            registeredAt: row?.registeredAt ?? null,
            commandCount: row?.commandCount ?? null,
            requestedAt: row?.requestedAt ?? null,
            failedAt: row?.failedAt ?? null,
            failure: row?.failure ?? null,
        }
    },
})

/**
 * "Znovu zaregistrovat" (N3-04, N3-B03): asks the bot for an immediate
 * registration. A live Discord action, excluded from `/api/v1` on purpose.
 */
export const requestRegistration = mutation({
    args: dashboardArgs,
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const now = Date.now()
        const existing = await registrationOf(ctx, args.guildId)
        if (
            existing?.requestedAt !== undefined &&
            now - existing.requestedAt < REQUEST_DEBOUNCE_MS
        )
            return { requestedAt: existing.requestedAt }
        if (existing)
            await ctx.db.patch(existing._id, {
                requestedAt: now,
                updatedAt: now,
            })
        else
            await ctx.db.insert("discordCommandRegistrations", {
                guildId: args.guildId,
                requestedAt: now,
                updatedAt: now,
            })
        return { requestedAt: now }
    },
})

/**
 * Saves the "Příkazy" page (N3-B01): the per-command settings and `/stats`'s
 * switch, games and share channel. The bot sees the change through its live
 * query and registers the commands again (N3-B02).
 */
export const saveSettings = mutation({
    args: {
        ...dashboardArgs,
        commandSettings: commandSettingsValidator,
        statsSettings: statsSettingsValidator,
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const commandSettings: StoredCommandSettings =
            storedCommandSettingsSchema.parse(args.commandSettings)
        const statsSettings = statsCommandSettingsSchema.parse(
            args.statsSettings
        )
        const now = new Date().toISOString()
        const existing = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        if (existing) {
            await ctx.db.patch(existing._id, {
                commandSettings,
                statsSettings,
                updatedAt: now,
            })
            return { ok: true }
        }
        await ctx.db.insert("discordConfigs", {
            guildId: args.guildId,
            timezone: "UTC",
            defaultLanguage: "en",
            calendarCategories: [],
            commandSettings,
            statsSettings,
            createdAt: now,
            updatedAt: now,
        })
        return { ok: true }
    },
})
