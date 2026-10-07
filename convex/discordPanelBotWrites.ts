import {
    guildPanel,
    guildPanels,
    panelActionStore,
    panelStatusRecord,
    panelStatusRow,
    purgePanel,
} from "./discordPanelStore"
import {
    botHeartbeatSchema,
    panelAttemptSchema,
} from "../src/domain/discord-publications/panel-delivery.schema"
import { requestPanelAction } from "../src/application/discord-publications/panel-actions"
import { nextPanelStatus } from "../src/domain/discord-publications/panel-delivery"
import { normalizePanelKind } from "../src/domain/discord-publications/settings"
import { panelAction } from "./discordPublicationTable"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./_generated/server"
import { v } from "convex/values"

/**
 * The bot's writes of "Panely v Discordu": the heartbeat, the result of each
 * pass over a panel, removing a panel once its messages are gone and the
 * actions from the "Ovládání serveru" message. They validate the bot's
 * reports with Zod, so they live apart from the reads in
 * `discordPanelBot.ts`, which the bot calls every 15 s per clan and which
 * must stay a small module (ARCHITECTURE.md, "Convex hot paths"). Every
 * function requires the internal secret.
 */
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
