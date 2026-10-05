import type { Client, MessageCreateOptions } from "discord.js"
import { makeFunctionReference } from "convex/server"

import {
    seedCallMessage,
    seedControlMessage,
    seedIntroMessage,
    type SeedGuildContext,
} from "./render"
import {
    seedPublicationKey,
    type SeedMessageKind,
} from "../../../src/domain/discord-seed/publication-keys"
import {
    PublicationChannelError,
    publishManagedMessage,
} from "../sync/publication"
import { PublicationNotSent } from "../../../src/application/discord-publications/publish"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import { SEED_CALL_REFRESH_SECONDS } from "../../../src/domain/discord-seed/views"
import { deliverSeedCall } from "../../../src/application/discord-seed/delivery"
import { resolveClanTimeZone } from "../../../src/domain/discord-seed/clock"
import type { SeedFailure } from "../../../src/domain/discord-seed/run"
import type { SeedDeliveryState } from "../../../convex/discordSeedBot"
import { getSeedMessages } from "../../../src/lib/clan-language/seed"
import { clanLanguageForGuild } from "../runtime/clan-language"
import { channelAccess } from "../public-panels/worker"
import { reportToErrorsChannel } from "../ui/replies"
import { seedMessagePayload } from "./payload"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

/**
 * The seed worker (board P5): every 20 s it visits each clan and keeps its
 * seed messages current — the call of a running seed (redrawn every 60 s and
 * finalised or deleted at the end), one "Ovládání serveru" message per
 * server in the private admin channel and the pinned intro of each seed
 * channel. Logi decides when a seed starts and ends (the Convex tick); the
 * bot only draws. Messages go through the durable managed publisher, so a
 * second bot process or a retried pass never posts twice.
 */

const REFRESH_MS = SEED_CALL_REFRESH_SECONDS * 1000
const TICK_MS = 20_000

export type SeedWorkerPorts = {
    state(guildId: string): Promise<SeedDeliveryState>
    context(guildId: string): Promise<SeedGuildContext>
    publish(input: {
        guildId: string
        key: string
        revision: number
        channelId: string | null
        message: MessageCreateOptions
    }): Promise<string | null | undefined>
    /** Discord refused the channel for good (gone, wrong type, permissions). */
    isPermanentFailure(error: unknown): boolean
    record(input: {
        guildId: string
        kind: SeedMessageKind
        key: string
        revision: number
        error?: string
    }): Promise<unknown>
    callPosted(input: {
        guildId: string
        runId: string
        pingedMembers: number | null
    }): Promise<unknown>
    callFailed(input: {
        guildId: string
        runId: string
        reason: SeedFailure
    }): Promise<unknown>
    roleMemberCount(guildId: string, roleId: string): Promise<number | null>
    /** False when `@everyone` can view the channel; null when unknown. */
    channelPrivate(guildId: string, channelId: string): Promise<boolean | null>
    pin(guildId: string, channelId: string, messageId: string): Promise<void>
    /** One notice in the errors channel: the control channel is public. */
    controlChannelPublic(guildId: string, channelId: string): Promise<void>
    now(): number
}

/** When each message was last drawn, so running calls refresh every 60 s. */
export type SeedWorkerMemory = Map<string, number>

const errorText = (error: unknown) =>
    (error instanceof Error ? error.message : "Delivery failed.").slice(0, 240)

/**
 * One pass over one clan. `force` redraws everything now (after a button).
 * Answers the call message of each run it delivered.
 */
export async function runSeedGuild(
    guildId: string,
    ports: SeedWorkerPorts,
    memory: SeedWorkerMemory,
    options: { force?: boolean } = {}
): Promise<{ calls: Map<string, string | null> }> {
    const delivered = new Map<string, string | null>()
    const state = await ports.state(guildId)
    if (!state.servers.length && !state.calls.length && !state.intros.length)
        return { calls: delivered }
    const context = await ports.context(guildId)
    const kit = { language: context.language, style: context.messageStyle }
    const now = ports.now()
    const due = (
        key: string,
        outbox: { revision: number; deliveredRevision: number } | null,
        refresh: boolean
    ) =>
        options.force ||
        (outbox !== null && outbox.revision > outbox.deliveredRevision) ||
        (refresh && now - (memory.get(key) ?? 0) >= REFRESH_MS)
    const pending = (
        outbox: { revision: number; deliveredRevision: number } | null
    ) => outbox !== null && outbox.revision > outbox.deliveredRevision
    const settle = async (
        kind: SeedMessageKind,
        key: string,
        outbox: { revision: number; deliveredRevision: number } | null,
        error?: unknown
    ) => {
        if (!pending(outbox)) return
        await ports
            .record({
                guildId,
                kind,
                key,
                revision: outbox!.revision,
                ...(error ? { error: errorText(error) } : {}),
            })
            .catch((failure) =>
                logWarn("seed", "Seed delivery receipt failed", {
                    guildId,
                    key,
                    error: failure,
                })
            )
    }

    for (const call of state.calls) {
        const key = seedPublicationKey("call", call.run.id)
        if (!due(key, call.outbox, call.run.status === "seeding")) continue
        const server = state.servers.find(
            (item) => item.connectionId === call.run.connectionId
        )
        try {
            const { view, lead } = seedCallMessage(
                call.run,
                server,
                context,
                now
            )
            const message = seedMessagePayload(view, kit, lead)
            const result = await deliverSeedCall(
                {
                    run: call.run,
                    hasMessage: Boolean(call.message?.messageId),
                },
                {
                    discord: {
                        publish: (channelId) =>
                            ports.publish({
                                guildId,
                                key,
                                revision: call.outbox?.revision ?? 0,
                                channelId,
                                message,
                            }),
                        isPermanentFailure: ports.isPermanentFailure,
                        roleMemberCount: (roleId) =>
                            ports.roleMemberCount(guildId, roleId),
                    },
                    reports: {
                        posted: async (input) => {
                            await ports.callPosted({ guildId, ...input })
                        },
                        failed: async (input) => {
                            await ports.callFailed({ guildId, ...input })
                        },
                    },
                }
            )
            memory.set(key, now)
            if (result.kind === "delivered")
                delivered.set(call.run.id, result.messageId)
            if (
                result.kind === "delivered" ||
                (call.run.status !== "seeding" && !call.message?.messageId)
            )
                await settle("call", call.run.id, call.outbox)
        } catch (error) {
            memory.set(key, now)
            await settle("call", call.run.id, call.outbox, error)
            logWarn("seed", "Seed call delivery failed; will retry", {
                guildId,
                runId: call.run.id,
                error,
            })
        }
    }

    for (const server of state.servers) {
        const key = seedPublicationKey("control", server.connectionId)
        const exists = Boolean(server.control.message?.messageId)
        const channelId = server.settings.controlChannelId
        if (!channelId && !exists) continue
        if (!due(key, server.control.outbox, true)) continue
        try {
            let target = channelId
            if (target) {
                const isPrivate = await ports.channelPrivate(guildId, target)
                if (isPrivate === false) {
                    // P3-22: the admin controls only where @everyone cannot look.
                    if (pending(server.control.outbox))
                        await ports.controlChannelPublic(guildId, target)
                    target = null
                }
            }
            if (!target && !exists) {
                memory.set(key, now)
                await settle(
                    "control",
                    server.connectionId,
                    server.control.outbox,
                    channelId ? new Error("control_channel_public") : undefined
                )
                continue
            }
            await ports.publish({
                guildId,
                key,
                revision: server.control.outbox?.revision ?? 0,
                channelId: target,
                message: seedMessagePayload(
                    seedControlMessage(server, context),
                    kit
                ),
            })
            memory.set(key, now)
            await settle("control", server.connectionId, server.control.outbox)
        } catch (error) {
            memory.set(key, now)
            await settle(
                "control",
                server.connectionId,
                server.control.outbox,
                error
            )
            logWarn("seed", "Seed control message failed; will retry", {
                guildId,
                connectionId: server.connectionId,
                error,
            })
        }
    }

    for (const intro of state.intros) {
        const key = seedPublicationKey("intro", intro.channelId)
        if (!due(key, intro.outbox, false)) continue
        try {
            const view = seedIntroMessage(intro, context)
            const exists = Boolean(intro.message?.messageId)
            if (!view && !exists) {
                await settle("intro", intro.channelId, intro.outbox)
                continue
            }
            const messageId = await ports.publish({
                guildId,
                key,
                revision: intro.outbox?.revision ?? 0,
                channelId: view ? intro.channelId : null,
                // A removal sends nothing; the payload only feeds the hash.
                message: seedMessagePayload(
                    view ?? {
                        accent: "clan",
                        blocks: [{ kind: "text", markdown: "-" }],
                    },
                    kit
                ),
            })
            memory.set(key, now)
            if (view && messageId)
                await ports
                    .pin(guildId, intro.channelId, messageId)
                    .catch((error) =>
                        logWarn("seed", "Seed intro could not be pinned", {
                            guildId,
                            channelId: intro.channelId,
                            error,
                        })
                    )
            await settle("intro", intro.channelId, intro.outbox)
        } catch (error) {
            memory.set(key, now)
            await settle("intro", intro.channelId, intro.outbox, error)
            logWarn("seed", "Seed intro failed; will retry", {
                guildId,
                channelId: intro.channelId,
                error,
            })
        }
    }
    return { calls: delivered }
}

const query = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.query(makeFunctionReference<"query">(name), {
        secret: env.internalSecret,
        ...args,
    }) as Promise<T>
const mutation = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.mutation(makeFunctionReference<"mutation">(name), {
        secret: env.internalSecret,
        ...args,
    }) as Promise<T>

/** Whether an error means Discord will not take the call in that channel. */
export function isPermanentSeedFailure(error: unknown): boolean {
    for (
        let current: unknown = error, depth = 0;
        current && depth < 4;
        current = (current as { cause?: unknown }).cause, depth++
    )
        if (
            current instanceof PublicationChannelError ||
            current instanceof PublicationNotSent
        )
            return true
    return false
}

/** The clan's language, zone, name and message style for the seed messages. */
export async function readSeedGuildContext(
    guildId: string,
    guildName: string | null = null
): Promise<SeedGuildContext> {
    const context = await query<{
        language: string
        timeZone: string
        clanName: string | null
        messageStyle: MessageStyle | null
    }>("discordPanelBot:guildContext", { guildId })
    return {
        language: context.language,
        timeZone: resolveClanTimeZone(context.timeZone),
        clanName: context.clanName ?? guildName,
        messageStyle: context.messageStyle,
        siteUrl: env.appSiteUrl,
    }
}

/** The Discord and Convex side of the seed worker. */
export function seedWorkerPorts(client: Client): SeedWorkerPorts {
    const guild = (guildId: string) => client.guilds.fetch(guildId)
    return {
        state: (guildId) =>
            query<SeedDeliveryState>("discordSeedBot:deliveryState", {
                guildId,
            }),
        context: (guildId) =>
            readSeedGuildContext(
                guildId,
                client.guilds.cache.get(guildId)?.name ?? null
            ),
        publish: (input) => publishManagedMessage(client, input),
        isPermanentFailure: isPermanentSeedFailure,
        record: (input) => mutation("discordSeedBot:recordDelivery", input),
        callPosted: (input) =>
            mutation("discordSeedBot:recordCallPosted", input),
        callFailed: (input) =>
            mutation("discordSeedBot:reportCallFailed", input),
        roleMemberCount: async (guildId, roleId) => {
            try {
                const found = await guild(guildId)
                await found.members.fetch()
                return found.roles.cache.get(roleId)?.members.size ?? null
            } catch {
                return null
            }
        },
        channelPrivate: async (guildId, channelId) => {
            const access = await channelAccess(await guild(guildId), channelId)
            return access ? !access.everyoneCanView : null
        },
        pin: async (guildId, channelId, messageId) => {
            const channel = await (
                await guild(guildId)
            ).channels.fetch(channelId)
            if (!channel?.isTextBased()) return
            const message = await channel.messages.fetch(messageId)
            if (!message.pinned) await message.pin()
        },
        controlChannelPublic: async (guildId, channelId) => {
            const copy = getSeedMessages(await clanLanguageForGuild(guildId))
            await reportToErrorsChannel({
                client,
                guildId,
                error: new Error(
                    copy.errors.controlChannelPublic(`<#${channelId}>`)
                ),
                action: copy.errors.controlAction,
                location: "Server seeding",
                scope: "seed-control",
                target: `<#${channelId}>`,
            })
        },
        now: Date.now,
    }
}

let shared: { ports: SeedWorkerPorts; memory: SeedWorkerMemory } | null = null
const running = new Set<string>()

/** One pass over one clan now (after a button); waits for a pass in progress. */
export async function refreshSeedGuild(guildId: string) {
    if (!shared) return { calls: new Map<string, string | null>() }
    for (let i = 0; running.has(guildId) && i < 40; i++)
        await new Promise((resolve) => setTimeout(resolve, 250))
    running.add(guildId)
    try {
        return await runSeedGuild(guildId, shared.ports, shared.memory, {
            force: true,
        })
    } finally {
        running.delete(guildId)
    }
}

export function startSeedWorker(client: Client) {
    shared = { ports: seedWorkerPorts(client), memory: new Map() }
    let ticking = false
    const tick = async () => {
        if (ticking || !shared) return
        ticking = true
        try {
            for (const guild of client.guilds.cache.values()) {
                if (running.has(guild.id)) continue
                running.add(guild.id)
                try {
                    await runSeedGuild(guild.id, shared.ports, shared.memory)
                } catch (error) {
                    // One clan's failure never blocks the others.
                    logWarn("seed", "Seed pass failed", {
                        guildId: guild.id,
                        error,
                    })
                } finally {
                    running.delete(guild.id)
                }
            }
        } finally {
            ticking = false
        }
    }
    const timer = setInterval(() => void tick(), TICK_MS)
    timer.unref()
    void tick()
    return () => clearInterval(timer)
}
