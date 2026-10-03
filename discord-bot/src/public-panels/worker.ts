import {
    renderPanel,
    renderPlayers,
    renderResult,
    type FactionIcons,
    type LiveData,
} from "./render"
import {
    synchronizeResults,
    type ResultEvent,
} from "../../../src/application/discord-publications/results"
import {
    MessageFlags,
    PermissionFlagsBits,
    type ButtonInteraction,
    type Client,
} from "discord.js"
import type { WarconServed } from "../../../src/application/game-data/read-warcon"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import type { Doc } from "../../../convex/_generated/dataModel"
import { completePrivatePlayerReply } from "./private-reply"
import { publishManagedMessage } from "../sync/publication"
import { factionAssets, panelArtwork } from "./assets"
import { makeFunctionReference } from "convex/server"
import { loadPlayerDetails } from "./player-details"
import { logWarn as writeWarning } from "../log"
import { env } from "../environment"
import { convex } from "../convex"

function logWarn(...args: Parameters<typeof writeWarning>) {
    try {
        writeWarning(...args)
    } catch {
        console.warn(`[public-panels] ${args[1]}`)
    }
}
type Panel = Doc<"discordPublicPanels"> & { snapshot: ServerSnapshot | null }
const query = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.query(makeFunctionReference<"query">(name), {
        secret: env.internalSecret,
        ...args,
    })
async function panels(guildId: string) {
    return query<Panel[]>("discordPublicPanels:forGuild", { guildId })
}
async function live(panel: Panel): Promise<LiveData | null> {
    if (!panel.enabled || panel.snapshot?.provider !== "wardogs_warcon")
        return null
    const result: WarconServed = await convex.action(
        makeFunctionReference<"action">("warconData:read"),
        {
            secret: env.internalSecret,
            guildId: panel.guildId,
            panelId: panel._id,
            connectionId: panel.connectionId,
            queryJson: '{"view":"live"}',
        }
    )
    return result.kind === "ready" && result.envelope.result.view === "live"
        ? result.envelope.result.data
        : null
}
async function icons(client: Client): Promise<FactionIcons> {
    try {
        const values = await client.application?.emojis.fetch()
        return Object.fromEntries(
            (await factionAssets()).flatMap((asset) => {
                const found = values?.find((e) => e.name === asset.name)
                return found ? [[asset.faction, found.toString()]] : []
            })
        )
    } catch {
        return {}
    }
}
export function startPublicPanelWorker(client: Client) {
    let running = false
    let cachedIcons: FactionIcons = {},
        iconsAt = 0
    const due = new Map<string, { at: number; revision: number }>()
    const tick = async () => {
        if (running) return
        running = true
        try {
            if (Date.now() >= iconsAt) {
                cachedIcons = await icons(client)
                iconsAt = Date.now() + 3_600_000
            }
            for (const guild of client.guilds.cache.values()) {
                for (const panel of await panels(guild.id)) {
                    const previous = due.get(panel._id)
                    if (
                        previous &&
                        previous.revision === panel.revision &&
                        previous.at > Date.now()
                    )
                        continue
                    try {
                        if (panel.kind === "results")
                            await syncResults(client, panel, cachedIcons)
                        else {
                            const current = await live(panel)
                            const artwork = panel.artwork
                                ? await panelArtwork(
                                      panel.gameId,
                                      current?.status?.map ??
                                          panel.snapshot?.map
                                  )
                                : null
                            await publishManagedMessage(client, {
                                guildId: guild.id,
                                key: `panel:${panel._id}`,
                                revision: panel.revision,
                                channelId: panel.channelId,
                                message: {
                                    ...renderPanel(
                                        { ...panel, id: panel._id },
                                        panel.snapshot,
                                        current,
                                        cachedIcons,
                                        env.appSiteUrl,
                                        artwork?.url
                                    ),
                                    ...(artwork
                                        ? {
                                              files: [
                                                  {
                                                      attachment: artwork.path,
                                                      name: artwork.name,
                                                  },
                                              ],
                                          }
                                        : {}),
                                },
                            })
                        }
                        due.set(panel._id, {
                            at: Date.now() + panel.refreshSeconds * 1000,
                            revision: panel.revision,
                        })
                    } catch {
                        // The publisher persists its sanitized error. Keep one failing
                        // destination from blocking the rest of this guild.
                        due.set(panel._id, {
                            at: Date.now() + 30_000,
                            revision: panel.revision,
                        })
                        logWarn(
                            "public-panels",
                            "Panel refresh failed; will retry",
                            { panelId: panel._id }
                        )
                    }
                }
            }
        } catch {
            logWarn(
                "public-panels",
                "Panel configuration unavailable; will retry"
            )
        } finally {
            running = false
        }
    }
    const timer = setInterval(() => void tick(), 15_000)
    timer.unref()
    void tick()
    return () => clearInterval(timer)
}
async function syncResults(client: Client, panel: Panel, emoji: FactionIcons) {
    await synchronizeResults(
        { ...panel, id: panel._id },
        {
            bindings: async () =>
                (
                    await query<Doc<"discordPublications">[]>(
                        "discordPublications:bindings",
                        { guildId: panel.guildId }
                    )
                ).map((b) => b.key),
            page: (cursor) =>
                query<{ cursor: string | null; events: ResultEvent[] } | null>(
                    "discordPublicPanels:resultsPage",
                    { panelId: panel._id, cursor }
                ),
            publish: async (key, channelId, event) => {
                await publishManagedMessage(client, {
                    guildId: panel.guildId,
                    key,
                    revision: panel.revision,
                    channelId,
                    message: event?.result
                        ? renderResult(
                              { ...event, result: event.result },
                              emoji
                          )
                        : {},
                })
            },
        }
    )
}
export async function handlePublicPanelButton(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("logi:players:")) return false
    if (interaction.message.flags.has(MessageFlags.Ephemeral))
        await interaction.deferUpdate()
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    await completePrivatePlayerReply(
        (reply) => interaction.editReply(reply),
        async () => {
            const result = await loadPlayerDetails<Panel, LiveData>(
                interaction,
                {
                    readPanel: async (id) =>
                        interaction.guildId
                            ? ((await panels(interaction.guildId)).find(
                                  (p) => p._id === id
                              ) ?? null)
                            : null,
                    readLive: live,
                    canView: async (panel) => {
                        if (
                            !interaction.guild ||
                            interaction.guild.id !== panel.guildId
                        )
                            return false
                        // Force fresh channel overwrites, member roles, role permissions,
                        // and guild ownership. Cached interaction/member state is not proof.
                        const guild = await interaction.guild.fetch()
                        const [channel, member] = await Promise.all([
                            guild.channels.fetch(panel.channelId, {
                                force: true,
                            }),
                            guild.members.fetch({
                                user: interaction.user.id,
                                force: true,
                            }),
                            guild.roles.fetch(),
                        ])
                        return Boolean(
                            channel &&
                            channel
                                .permissionsFor(member)
                                ?.has([
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.ReadMessageHistory,
                                ])
                        )
                    },
                }
            )
            if (!result)
                return {
                    content:
                        "Player details unavailable or this panel changed. Open the current panel in its channel.",
                    components: [],
                }
            return renderPlayers(
                { id: result.panel._id, revision: result.panel.revision },
                result.data,
                result.page
            )
        }
    )
    return true
}
