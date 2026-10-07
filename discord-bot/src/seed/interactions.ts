import { MessageFlags, type ButtonInteraction } from "discord.js"
import { makeFunctionReference } from "convex/server"

import {
    seedActionReplyView,
    seedRoleReplyView,
    type SeedButtonResult,
    type SeedControlAction,
} from "../../../src/domain/discord-seed/views"
import {
    interactionLanguage,
    replyAdminFixableError,
    replyPrivately,
} from "../ui/replies"
import type { SeedActionResult } from "../../../src/application/discord-seed/action-result"
import { commandAccessConfig } from "../../../src/domain/discord-commands/guild-config"
import { toggleSeedRole } from "../../../src/application/discord-seed/toggle-role"
import { isLogiAdmin } from "../../../src/domain/discord-commands/permissions"
import { defaultAccessConfig, readFreshCaller } from "../commands/access"
import type { SeedDeliveryState } from "../../../convex/discordSeedBot"
import { guildCommandConfigs, workspaceOf } from "../commands/runtime"
import { getSeedMessages } from "../../../src/lib/clan-language/seed"
import type { InteractionFeature } from "../interactions/registry"
import { readSeedGuildContext, refreshSeedGuild } from "./worker"
import type { SeedGuildContext } from "./render"
import { env } from "../environment"
import { convex } from "../convex"

/**
 * The seed buttons (board P5), routed through the interaction registry:
 * - `seed:role:<roleId>` "Zvát mě na seed" on the intro and every call;
 * - `seed:start|stop:<connectionId>` "Spustit seed" / "Ukončit seed";
 * - `seed:refresh|pause|resume:<connectionId>` the server's panel.
 * Every control click checks the member's Logi admin right fresh from
 * Discord, even though only admins see the channel (P5-29); the answer is
 * private.
 */

type PanelActResult =
    | { status: "accepted" }
    | { status: "not_found" }
    | { status: "rejected"; reason: string }

export type SeedButtonPorts = {
    language(guildId: string | null): Promise<string | undefined>
    context(guildId: string): Promise<SeedGuildContext>
    /** Fresh from Discord; null when Discord does not answer. */
    isAdmin(interaction: ButtonInteraction): Promise<boolean | null>
    state(guildId: string): Promise<SeedDeliveryState>
    start(input: {
        guildId: string
        connectionId: string
        discordUserId: string
        displayName: string
        channelId: string
        interactionId: string
    }): Promise<SeedActionResult>
    stop(input: {
        guildId: string
        connectionId: string
        discordUserId: string
        displayName: string
        channelId: string
    }): Promise<SeedActionResult>
    panel(input: {
        guildId: string
        actorId: string
        action: "refresh" | "pause" | "resume"
        connectionId: string
    }): Promise<PanelActResult>
    /** One delivery pass now; answers the call message of each run it drew. */
    refresh(guildId: string): Promise<{ calls: Map<string, string | null> }>
    /** The P3 page at this server's tab ("Naplánovat v Logi"). */
    planUrl(
        guildId: string,
        language: string,
        connectionId: string
    ): Promise<string | null>
    roleOffer(
        guildId: string,
        roleId: string
    ): Promise<{ offered: boolean; seedChannelId: string | null }>
    now(): number
}

const CONTROL_ACTIONS: readonly SeedControlAction[] = [
    "start",
    "stop",
    "refresh",
    "pause",
    "resume",
]

const ephemeral = { flags: MessageFlags.Ephemeral } as const

function displayName(interaction: ButtonInteraction) {
    const member = interaction.member
    const nick =
        member &&
        "displayName" in member &&
        typeof member.displayName === "string"
            ? member.displayName
            : null
    return nick || interaction.user.globalName || interaction.user.username
}

async function handleControl(
    interaction: ButtonInteraction,
    action: SeedControlAction,
    connectionId: string,
    ports: SeedButtonPorts
) {
    const guildId = interaction.guildId
    if (!guildId) return
    await interaction.deferReply(ephemeral)
    const language = (await ports.language(guildId)) ?? "en"
    const context = await ports.context(guildId)
    const kit = { language, style: context.messageStyle }
    const copy = getSeedMessages(language)
    const state = await ports.state(guildId)
    const server = state.servers.find(
        (item) => item.connectionId === connectionId
    )
    const reply = async (
        result: SeedButtonResult,
        callUrl: string | null = null
    ) =>
        replyPrivately(
            interaction,
            seedActionReplyView({
                result,
                server:
                    server?.name ??
                    copy.game[server?.gameId ?? "hell_let_loose"],
                panelChannel: server?.panel
                    ? `<#${server.panel.channelId}>`
                    : null,
                callUrl,
                planUrl: await ports.planUrl(guildId, language, connectionId),
                cooldownMinutes: server?.settings.cooldownMinutes ?? 120,
                liveFrom: server?.settings.liveFrom ?? 40,
                now: ports.now(),
                timeZone: context.timeZone,
                locale: copy.locale,
                copy,
            }),
            kit
        )

    if ((await ports.isAdmin(interaction)) !== true)
        return reply({ status: "forbidden" })

    const actor = {
        guildId,
        connectionId,
        discordUserId: interaction.user.id,
        displayName: displayName(interaction),
        channelId: interaction.channelId,
    }
    const callLink = (
        runId: string,
        channelId: string,
        messageId: string | null | undefined
    ) =>
        messageId
            ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
            : null

    if (action === "start" || action === "stop") {
        const result =
            action === "start"
                ? await ports.start({ ...actor, interactionId: interaction.id })
                : await ports.stop(actor)
        if (result.status === "forbidden") return reply(result)
        const drawn = await ports
            .refresh(guildId)
            .catch(() => ({ calls: new Map<string, string | null>() }))
        if (result.status === "started")
            return reply(
                {
                    status: "started",
                    channelId: result.channelId,
                    pinged: result.pinged,
                },
                callLink(
                    result.runId,
                    result.channelId,
                    drawn.calls.get(result.runId)
                )
            )
        const running = server?.activeRun
        const runningUrl =
            running &&
            (result.status === "running" || result.status === "duplicate")
                ? callLink(
                      running.id,
                      running.channelId,
                      drawn.calls.get(running.id) ??
                          state.calls.find((call) => call.run.id === running.id)
                              ?.message?.messageId
                  )
                : null
        switch (result.status) {
            case "duplicate":
                return reply({ status: "duplicate" }, runningUrl)
            case "running":
                return reply({ status: "running" }, runningUrl)
            case "stopped":
                return reply({ status: "stopped" })
            case "cooldown":
                return reply({ status: "cooldown", retryAt: result.retryAt })
            case "unavailable":
                return reply({ status: "unavailable", reason: result.reason })
            case "not_found":
                return reply({ status: "not_found" })
        }
    }

    const panelAction = action as "refresh" | "pause" | "resume"
    const result = await ports.panel({
        guildId,
        actorId: interaction.user.id,
        action: panelAction,
        connectionId,
    })
    if (result.status === "accepted") {
        // The control message's "Pozastavit panel" / "Pokračovat" follows now.
        await ports.refresh(guildId).catch(() => null)
        return reply({ status: "panel", action: panelAction })
    }
    return reply(
        result.status === "rejected" && result.reason === "not_sent"
            ? { status: "panel_not_sent" }
            : { status: "panel_missing" }
    )
}

async function handleRole(
    interaction: ButtonInteraction,
    roleId: string,
    ports: SeedButtonPorts
) {
    const guildId = interaction.guildId
    if (!guildId || !interaction.guild) return
    await interaction.deferReply(ephemeral)
    const language = (await ports.language(guildId)) ?? "en"
    const context = await ports.context(guildId)
    const kit = { language, style: context.messageStyle }
    const copy = getSeedMessages(language)
    let seedChannelId: string | null = null
    const guild = interaction.guild
    const outcome = await toggleSeedRole(
        {
            offered: async (id) => {
                const offer = await ports.roleOffer(guildId, id)
                seedChannelId = offer.seedChannelId
                return offer.offered
            },
            // Fresh from Discord, never the cached member.
            observe: async () => {
                const member = await guild.members.fetch({
                    user: interaction.user.id,
                    force: true,
                })
                return { roleIds: [...member.roles.cache.keys()] }
            },
            change: async (action, id) => {
                const member = await guild.members.fetch({
                    user: interaction.user.id,
                    force: true,
                })
                if (action === "add")
                    await member.roles.add(id, "Logi: Zvát mě na seed")
                else await member.roles.remove(id, "Logi: Zvát mě na seed")
            },
        },
        roleId
    )
    if (outcome.kind === "failed")
        return replyAdminFixableError(
            interaction,
            {
                title: copy.role.failedTitle,
                report: {
                    error: outcome.error,
                    action: "Toggle the Seed role",
                    location: "Server seeding",
                    scope: "seed-role",
                    target: `<@&${roleId}>`,
                },
            },
            kit
        )
    const channel = seedChannelId ? `<#${seedChannelId}>` : "#seed"
    return replyPrivately(
        interaction,
        seedRoleReplyView(outcome.kind, copy, channel),
        kit
    )
}

/** The seed buttons with the given ports. */
export function seedInteractionFeature(
    ports: SeedButtonPorts
): InteractionFeature {
    return {
        name: "seed",
        register(registry) {
            registry.button("seed:", async (interaction) => {
                const [, kind, ...rest] = interaction.customId.split(":")
                const value = rest.join(":")
                if (!value) return
                if (kind === "role")
                    return handleRole(interaction, value, ports)
                if ((CONTROL_ACTIONS as readonly string[]).includes(kind ?? ""))
                    return handleControl(
                        interaction,
                        kind as SeedControlAction,
                        value,
                        ports
                    )
            })
        },
    }
}

const mutation = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.mutation(makeFunctionReference<"mutation">(name), {
        secret: env.internalSecret,
        ...args,
    }) as Promise<T>
const query = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.query(makeFunctionReference<"query">(name), {
        secret: env.internalSecret,
        ...args,
    }) as Promise<T>

/** The Discord and Convex side of the seed buttons. */
export const defaultSeedButtonPorts: SeedButtonPorts = {
    language: interactionLanguage,
    context: (guildId) => readSeedGuildContext(guildId),
    isAdmin: async (interaction) => {
        const caller = await readFreshCaller(
            interaction.guild,
            interaction.user.id
        )
        if (!caller) return null
        const config = await guildCommandConfigs.get(interaction.guildId)
        return isLogiAdmin(
            caller,
            config ? commandAccessConfig(config) : defaultAccessConfig()
        )
    },
    state: (guildId) =>
        query<SeedDeliveryState>("discordSeedBot:deliveryState", { guildId }),
    start: (input) => mutation("discordSeedBot:startFromDiscord", input),
    stop: (input) => mutation("discordSeedBot:stopFromDiscord", input),
    panel: (input) => mutation("discordPanelBotWrites:act", input),
    refresh: refreshSeedGuild,
    planUrl: async (guildId, language, connectionId) => {
        const workspace = await workspaceOf(guildId)
        if (!workspace) return null
        const url = new URL(
            `/${language}/dashboard/servers/${encodeURIComponent(workspace.workspaceId)}/settings/discord-seed`,
            env.appSiteUrl
        )
        url.searchParams.set("server", connectionId)
        return url.toString()
    },
    roleOffer: (guildId, roleId) =>
        query("discordSeedBot:roleOffer", { guildId, roleId }),
    now: Date.now,
}

export const seedInteractions = seedInteractionFeature(defaultSeedButtonPorts)
