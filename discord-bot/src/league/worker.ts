import {
    Events,
    type Client,
    type Message,
    type PartialMessage,
    type ReadonlyCollection,
    type Snowflake,
} from "discord.js"
import type { LeagueFixture } from "../../../src/domain/wardogs-league/fixture"
import { humanLeagueInput, leagueCardCopy, renderLeagueCard } from "./render"
import { panelArtwork, factionAssets } from "../public-panels/assets"
import { clanLanguageForGuild } from "../runtime/clan-language"
import { publishManagedMessage } from "../sync/publication"
import { makeFunctionReference } from "convex/server"
import { env } from "../environment"
import { convex } from "../convex"
type GuildTracking = {
    settings: { enabled: boolean; inputChannelId: string | null }
    records: Array<{
        id: string
        revision: number
        channelId: string | null
        fixture: LeagueFixture | null
    }>
}
async function data(guildId: string): Promise<GuildTracking | null> {
    return convex.query(
        makeFunctionReference<"query">("leagueDiscovery:forGuild"),
        { secret: env.internalSecret, guildId }
    )
}
export function startLeagueWorker(client: Client) {
    let stopped = false,
        running = false,
        iconsAt = 0,
        icons: Record<string, string> = {}
    const tick = async () => {
        if (running || stopped) return
        running = true
        try {
            if (Date.now() > iconsAt) {
                try {
                    const emojis = await client.application?.emojis.fetch()
                    icons = Object.fromEntries(
                        (await factionAssets()).flatMap((asset) => {
                            const found = emojis?.find(
                                (e) => e.name === asset.name
                            )
                            return found
                                ? [[asset.faction, found.toString()]]
                                : []
                        })
                    )
                } catch {
                    /* Readable faction labels remain. */
                }
                iconsAt = Date.now() + 3600000
            }
            for (const guild of client.guilds.cache.values()) {
                const tracking = await data(guild.id)
                const language = tracking?.records.length
                    ? await clanLanguageForGuild(guild.id)
                    : undefined
                for (const row of tracking?.records ?? []) {
                    try {
                        const art = row.fixture
                            ? await panelArtwork(
                                  "wardogs",
                                  row.fixture.snapshot.map?.name
                              )
                            : null
                        const message = row.fixture
                            ? renderLeagueCard(
                                  row.fixture,
                                  art?.url,
                                  icons,
                                  language
                              )
                            : {
                                  content:
                                      leagueCardCopy(language)
                                          .fixtureUnavailable,
                                  allowedMentions: { parse: [] as never[] },
                              }
                        await publishManagedMessage(client, {
                            guildId: guild.id,
                            key: `league:${row.id}`,
                            revision: row.revision,
                            channelId: row.channelId,
                            message: {
                                ...message,
                                ...(art
                                    ? {
                                          files: [
                                              {
                                                  attachment: art.path,
                                                  name: art.name,
                                              },
                                          ],
                                      }
                                    : {}),
                            },
                        })
                    } catch {
                        console.warn(
                            "[league] Publication pending; verify channel access or retry."
                        )
                    }
                }
            }
        } catch {
            console.warn("[league] Tracking temporarily unavailable.")
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
