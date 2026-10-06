import { v } from "convex/values"

import {
    storedCommandSettingsSchema,
    type StoredCommandSettings,
} from "../src/domain/discord-commands/command-settings"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { guildCommandConfigFromStored } from "../src/domain/discord-commands/guild-config"
import { statsCommandSettingsSchema } from "../src/domain/player-stats/command-settings"
import { assertInternalSecret, statsSettingsValidator } from "./discord_shared"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
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
            ...(requestHandled
                ? { requestedAt: undefined, requestKind: undefined }
                : {}),
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
        // A pending save request is upgraded: this one must reach Discord.
        if (
            existing?.requestedAt !== undefined &&
            existing.requestKind !== "save" &&
            now - existing.requestedAt < REQUEST_DEBOUNCE_MS
        )
            return { requestedAt: existing.requestedAt }
        await writeRequest(ctx, args.guildId, now, "manual")
        return { requestedAt: now }
    },
})

async function writeRequest(
    ctx: MutationCtx,
    guildId: string,
    now: number,
    requestKind: "save" | "manual"
) {
    const existing = await registrationOf(ctx, guildId)
    if (existing)
        await ctx.db.patch(existing._id, {
            requestedAt: now,
            requestKind,
            updatedAt: now,
        })
    else
        await ctx.db.insert("discordCommandRegistrations", {
            guildId,
            requestedAt: now,
            requestKind,
            updatedAt: now,
        })
}

/**
 * After a save of the command settings, from the "Příkazy" page or the
 * `commands` slice of `/api/v1` (M1-B01, N3-B02): the bot registers again
 * and records the time and result, so "Zaregistrováno …" moves after every
 * save. Discord is only called when the commands differ; a pending
 * "Znovu zaregistrovat" keeps its stronger kind.
 */
export async function requestRegistrationAfterSave(
    ctx: MutationCtx,
    guildId: string,
    now = Date.now()
) {
    const existing = await registrationOf(ctx, guildId)
    const manualPending =
        existing?.requestedAt !== undefined && existing.requestKind !== "save"
    await writeRequest(ctx, guildId, now, manualPending ? "manual" : "save")
}

/**
 * Saves the "Příkazy" page (N3-B01): the per-command settings and `/stats`'s
 * switch, games and share channel. Every save asks for a registration, so
 * the bot registers the commands again and records it, even when Discord
 * already has the same commands (M1-B01, N3-B02).
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
        if (existing)
            await ctx.db.patch(existing._id, {
                commandSettings,
                statsSettings,
                updatedAt: now,
            })
        else
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
        await requestRegistrationAfterSave(ctx, args.guildId)
        return { ok: true }
    },
})
