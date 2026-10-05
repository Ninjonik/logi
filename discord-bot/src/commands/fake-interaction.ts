import { MessageFlags } from "discord.js"

import {
    guildCommandConfigFromStored,
    type GuildCommandConfig,
} from "../../../src/domain/discord-commands/guild-config"
import type { CommandCaller } from "../../../src/domain/discord-commands/permissions"

/**
 * Test doubles for command handlers: an interaction that tracks Discord's
 * acknowledgement like discord.js, a server's settings and a fresh caller.
 * No Discord or Convex call is made.
 */

export const TEST_GUILD = "100000000000000000"
export const TEST_USER = "100000000000000017"
export const TEST_CHANNEL = "300000000000000001"

export type Sent = { kind: "reply" | "edit" | "followUp"; value: unknown }

export function fakeInteraction<T>(fields: Record<string, unknown> = {}) {
    const sent: Sent[] = []
    const state = {
        deferred: false,
        replied: false,
        ephemeral: null as boolean | null,
    }
    const interaction = Object.assign(state, {
        guildId: TEST_GUILD,
        channelId: TEST_CHANNEL,
        channel: null,
        guild: null,
        user: { id: TEST_USER, username: "Hráč 17" },
        locale: "de",
        deferReply: async (value: { flags?: number } = {}) => {
            state.deferred = true
            state.ephemeral = value.flags === MessageFlags.Ephemeral
        },
        deferUpdate: async () => {
            state.deferred = true
        },
        reply: async (value: unknown) => {
            state.replied = true
            sent.push({ kind: "reply", value })
        },
        editReply: async (value: unknown) => {
            if (!state.deferred) throw new Error("edit before acknowledgement")
            sent.push({ kind: "edit", value })
        },
        followUp: async (value: unknown) => {
            sent.push({ kind: "followUp", value })
        },
        deleteReply: async () => {},
        ...fields,
    })
    return {
        interaction: interaction as unknown as T,
        sent,
        /** Everything the person saw, as JSON. */
        text: () => JSON.stringify(sent.map((entry) => entry.value)),
        last: () => JSON.stringify(sent.at(-1)?.value ?? null),
    }
}

/** A connected Czech clan with optional stored settings. */
export function testGuildConfig(
    stored: Record<string, unknown> = {}
): GuildCommandConfig {
    return guildCommandConfigFromStored({
        config: {
            guildId: TEST_GUILD,
            defaultLanguage: "cs",
            timezone: "Europe/Prague",
            dashboardAdminRoleId: "100000000000000001",
            clanRoleId: "100000000000000002",
            announcementsChannelId: "300000000000000003",
            ...stored,
        },
    })
}

export const configsOf = (config: GuildCommandConfig | null) => ({
    get: async () => config,
    peek: () => config ?? undefined,
})

export const callerOf =
    (caller: CommandCaller | null) => async (): Promise<CommandCaller | null> =>
        caller
