import {
    Events,
    type Client,
    type Message,
    type PartialMessage,
    type ReadonlyCollection,
    type Snowflake,
} from "discord.js"
import type { LeagueLinkReplyView } from "../../../src/domain/wardogs-league/link-reply"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import { LEAGUE_CARD_KEY_PREFIX } from "../../../src/domain/discord-publications/keys"
import { humanLeagueInput, linkReplyPayload } from "./render"
import { publishManagedMessage } from "../sync/publication"
import { makeFunctionReference } from "convex/server"
import { env } from "../environment"
import { convex } from "../convex"

const query = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.query(makeFunctionReference<"query">(name), {
        secret: env.internalSecret,
        ...args,
    })
const mutation = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.mutation(makeFunctionReference<"mutation">(name), {
        secret: env.internalSecret,
        ...args,
    })

type GuildTracking = {
    settings: { enabled: boolean; inputChannelId: string | null }
    records: Array<{ id: string; revision: number }>
}
type Binding = {
    key: string
    messageId: string | null
    pending: { channelId: string; marker: string } | null
}

/**
 * The per-match League cards are retired (L3-50..55 superseded by the WD
 * League panels, P6): every card still in Discord is deleted once through
 * the managed publisher, which also forgets its binding.
 */
export async function retireLeagueCards(ports: {
    tracking: () => Promise<GuildTracking | null>
    bindings: () => Promise<Binding[]>
    withdraw: (key: string, revision: number) => Promise<unknown>
}) {
    const [tracking, bindings] = await Promise.all([
        ports.tracking(),
        ports.bindings(),
    ])
    const live = new Set(
        bindings
            .filter(
                (binding) =>
                    binding.key.startsWith("league:") &&
                    (binding.messageId || binding.pending)
            )
            .map((binding) => binding.key)
    )
    let removed = 0
    for (const record of tracking?.records ?? []) {
        const key = `league:${record.id}`
        if (!live.has(key)) continue
        await ports.withdraw(key, record.revision)
        removed++
    }
    return removed
}

export type PendingLinkReply = {
    messageId: string
    channelId: string
    reply: LeagueLinkReplyView
}

/**
 * Answers League links people posted in the links channel (L3-56, L3-57),
 * once per match: the "replied" flag is stored before the reply is sent, so
 * a restart never answers twice.
 */
export async function sendLeagueLinkReplies(ports: {
    pending: () => Promise<PendingLinkReply[]>
    context: () => Promise<{
        language: string
        timeZone: string
        messageStyle: MessageStyle | null
    }>
    markReplied: (messageId: string, matchId: string) => Promise<boolean>
    reply: (
        channelId: string,
        messageId: string,
        payload: ReturnType<typeof linkReplyPayload>
    ) => Promise<boolean>
}) {
    const pending = await ports.pending()
    if (!pending.length) return 0
    const context = await ports.context()
    let sent = 0
    for (const item of pending) {
        if (!(await ports.markReplied(item.messageId, item.reply.matchId)))
            continue
        const payload = linkReplyPayload(item.reply, {
            language: context.language,
            timeZone: context.timeZone,
            style: context.messageStyle,
            accentColor: null,
        })
        if (await ports.reply(item.channelId, item.messageId, payload)) sent++
    }
    return sent
}

export function startLeagueWorker(client: Client) {
    let stopped = false,
        running = false
    const tick = async () => {
        if (running || stopped) return
        running = true
        try {
            for (const guild of client.guilds.cache.values()) {
                try {
                    await retireLeagueCards({
                        tracking: () =>
                            query<GuildTracking | null>(
                                "leagueDiscovery:forGuild",
                                { guildId: guild.id }
                            ),
                        // Only the retired cards' keys, never the guild's
                        // whole publication table.
                        bindings: () =>
                            query<Binding[]>("discordPublications:bindings", {
                                guildId: guild.id,
                                prefix: LEAGUE_CARD_KEY_PREFIX,
                            }),
                        withdraw: (key, revision) =>
                            publishManagedMessage(client, {
                                guildId: guild.id,
                                key,
                                revision,
                                channelId: null,
                                message: {},
                            }),
                    })
                    if (env.leagueMessageContent)
                        await sendLeagueLinkReplies({
                            pending: () =>
                                query<PendingLinkReply[]>(
                                    "leagueDiscovery:pendingLinkReplies",
                                    { guildId: guild.id }
                                ),
                            context: () =>
                                query("discordPanelBot:guildContext", {
                                    guildId: guild.id,
                                }),
                            markReplied: (messageId, matchId) =>
                                mutation<boolean>(
                                    "leagueDiscovery:markLinkReplied",
                                    { guildId: guild.id, messageId, matchId }
                                ),
                            reply: async (channelId, messageId, payload) => {
                                const channel = await guild.channels
                                    .fetch(channelId)
                                    .catch(() => null)
                                if (!channel?.isTextBased()) return false
                                const original = await channel.messages
                                    .fetch(messageId)
                                    .catch(() => null)
                                if (!original) return false
                                await original.reply({
                                    ...payload,
                                    allowedMentions: {
                                        parse: [],
                                        repliedUser: false,
                                    },
                                })
                                return true
                            },
                        })
                } catch {
                    console.warn(
                        "[league] League cards or link replies pending; will retry."
                    )
                }
            }
        } finally {
            running = false
        }
    }
    const timer = setInterval(() => void tick(), 60_000)
    timer.unref()
    void tick()
    const cleanup: Array<() => void> = []
    if (env.leagueMessageContent) {
        const pending = new Map<string, Promise<void>>()
        let queued = 0
        const ingest = (
            input: Message | PartialMessage,
            deleted = false,
            receivedEdit = false
        ) => {
            if (stopped || !input.guildId || queued >= 100) return
            const key = `${input.guildId}:${input.id}`
            queued++
            const work = (pending.get(key) ?? Promise.resolve())
                .then(async () => {
                    if (deleted) {
                        await convex.mutation(
                            makeFunctionReference<"mutation">(
                                "leagueDiscovery:ingestMessage"
                            ),
                            {
                                secret: env.internalSecret,
                                guildId: input.guildId,
                                channelId: input.channelId,
                                messageId: input.id,
                                urls: [],
                                human: true,
                                version: Date.now(),
                                deleted: true,
                            }
                        )
                        return
                    }
                    const message = input.partial ? await input.fetch() : input
                    if (message.author.bot || message.webhookId) return
                    const settings: GuildTracking["settings"] | null =
                        await convex.query(
                            makeFunctionReference<"query">(
                                "leagueDiscovery:inputSettings"
                            ),
                            {
                                secret: env.internalSecret,
                                guildId: message.guildId!,
                            }
                        )
                    const urls = humanLeagueInput(
                        {
                            guildId: message.guildId,
                            channelId: message.channelId,
                            bot: message.author.bot,
                            webhookId: message.webhookId,
                            content: message.content,
                        },
                        settings?.enabled ? settings.inputChannelId : null,
                        receivedEdit
                    )
                    if (urls === null) return
                    await convex.mutation(
                        makeFunctionReference<"mutation">(
                            "leagueDiscovery:ingestMessage"
                        ),
                        {
                            secret: env.internalSecret,
                            guildId: message.guildId,
                            channelId: message.channelId,
                            messageId: message.id,
                            urls,
                            human: true,
                            version:
                                message.editedTimestamp ??
                                message.createdTimestamp,
                            deleted: false,
                        }
                    )
                })
                .catch(() => {
                    console.warn(
                        "[league] Human link intake could not complete."
                    )
                })
                .finally(() => {
                    queued--
                    if (pending.get(key) === work) pending.delete(key)
                })
            pending.set(key, work)
        }
        const created = (m: Message) => ingest(m)
        const updated = (
            _old: Message | PartialMessage,
            m: Message | PartialMessage
        ) => ingest(m, false, true)
        const deleted = (m: Message | PartialMessage) => ingest(m, true)
        const bulk = (
            messages: ReadonlyCollection<Snowflake, Message | PartialMessage>
        ) => {
            for (const m of messages.values()) ingest(m, true)
        }
        client.on(Events.MessageCreate, created)
        client.on(Events.MessageUpdate, updated)
        client.on(Events.MessageDelete, deleted)
        client.on(Events.MessageBulkDelete, bulk)
        cleanup.push(() => {
            client.off(Events.MessageCreate, created)
            client.off(Events.MessageUpdate, updated)
            client.off(Events.MessageDelete, deleted)
            client.off(Events.MessageBulkDelete, bulk)
        })
    }
    return () => {
        stopped = true
        clearInterval(timer)
        cleanup.forEach((stop) => stop())
    }
}
