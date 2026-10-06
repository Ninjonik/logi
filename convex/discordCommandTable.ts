import { defineTable } from "convex/server"
import { v } from "convex/values"

/** One command's settings on the "Příkazy" page (N3-B01); all optional. */
const commandEntry = v.object({
    enabled: v.optional(v.boolean()),
    audience: v.optional(
        v.union(
            v.literal("everyone"),
            v.literal("clanMembers"),
            v.literal("logiAdmins")
        )
    ),
    roleIds: v.optional(v.array(v.string())),
    reply: v.optional(v.union(v.literal("private"), v.literal("privateShare"))),
    channelIds: v.optional(v.array(v.string())),
})

/**
 * `discordConfigs.commandSettings`: per command, keyed by command (Convex
 * field names avoid "-", so `/server-status` is `serverStatus`). `/stats`
 * keeps its switch in `statsSettings`.
 */
export const commandSettingsValidator = v.object({
    help: v.optional(commandEntry),
    stats: v.optional(commandEntry),
    player: v.optional(commandEntry),
    link: v.optional(commandEntry),
    notice: v.optional(commandEntry),
    serverStatus: v.optional(commandEntry),
})

/**
 * The bot's last slash-command registration per Discord server (N3-03): when
 * it registered, how many commands, in which language and with which
 * definitions (a signature), plus a pending request: "Znovu zaregistrovat"
 * (`manual`, always calls Discord) or a save of the "Příkazy" page (`save`,
 * recorded even when Discord already has the same commands). Failures keep
 * a category, never Discord's message.
 */
export const discordCommandRegistrations = defineTable({
    guildId: v.string(),
    requestedAt: v.optional(v.number()),
    /** What asked for the pending request; missing means `manual`. */
    requestKind: v.optional(v.union(v.literal("save"), v.literal("manual"))),
    registeredAt: v.optional(v.number()),
    commandCount: v.optional(v.number()),
    language: v.optional(v.string()),
    signature: v.optional(v.string()),
    failedAt: v.optional(v.number()),
    failure: v.optional(
        v.union(
            v.literal("forbidden"),
            v.literal("rate_limited"),
            v.literal("unavailable")
        )
    ),
    updatedAt: v.number(),
}).index("guildId", ["guildId"])
