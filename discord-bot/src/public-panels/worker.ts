import {
    panelArtworkWanted,
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
import {
    cachedClanLanguage,
    clanLanguageForGuild,
} from "../runtime/clan-language"
import type { WarconServed } from "../../../src/application/game-data/read-warcon"
import type { ReportObservation } from "../../../src/domain/player-reports/report"
import type { HllServed } from "../../../src/application/game-data/read-hll-live"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import type { HllLive } from "../../../src/domain/game-data/hll-live"
import type { Doc } from "../../../convex/_generated/dataModel"
import { renderHllPanel, renderHllPlayers } from "./hll-render"
import { completePrivatePlayerReply } from "./private-reply"
import { publishManagedMessage } from "../sync/publication"
import { factionAssets, panelArtwork } from "./assets"
import { makeFunctionReference } from "convex/server"
import { loadPlayerDetails } from "./player-details"
import { logWarn as writeWarning } from "../log"
import { buildPublicMatchUrl } from "../utils"
import { env } from "../environment"
import { convex } from "../convex"
import { panelCopy } from "./copy"

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
async function hllLiveRead(panel: Panel): Promise<HllServed | null> {
    if (!panel.enabled || panel.snapshot?.provider !== "hll_crcon") return null
    return convex.action(makeFunctionReference<"action">("hllLiveData:read"), {
        secret: env.internalSecret,
        guildId: panel.guildId,
        connectionId: panel.connectionId,
        panelId: panel._id,
        panelRevision: panel.revision,
    })
}
async function hllLive(panel: Panel): Promise<HllLive | null> {
    const result = await hllLiveRead(panel)
    return result?.kind === "ready" ? result.envelope.data : null
}
/** Blank provider names or factions must not invalidate the whole report picker. */
function reportChoice(input: {
    name: string
    playerId: string | null
    team: string | null
}) {
    const name = input.name.trim(),
        team = input.team?.trim() || null,
        playerId = input.playerId?.trim() || null
    return name ? [{ name, playerId, team }] : []
}
export async function readReportObservation(
    guildId: string,
    panelId: string,
    revision: number
): Promise<ReportObservation> {
    const panel = (await panels(guildId)).find(
        (p) =>
            p._id === panelId &&
            p.enabled &&
            p.revision === revision &&
            p.reportCategoryId
    )
    if (!panel) throw Error("Report panel changed.")
    const empty = {
        map: panel.snapshot?.map ?? null,
        serverName: panel.snapshot?.displayName ?? null,
        observedAt: null,
        players: [],
    }
    if (panel.gameId === "hell_let_loose") {
        const data = await hllLive(panel)
        return data
            ? {
                  map: data.status?.map ?? null,
                  serverName: data.status?.serverName ?? null,
                  observedAt: data.playersAt,
                  players:
                      data.playersFreshness === "fresh"
                          ? data.players.flatMap((p) =>
                                reportChoice({
                                    name: p.name,
                                    playerId: p.playerId,
                                    team: p.team,
                                })
                            )
                          : [],
              }
            : empty
    }
    const data = await live(panel)
    return data
        ? {
              map: data.status?.map ?? null,
              serverName: data.status?.serverName ?? null,
              observedAt: data.playersAt,
              players:
                  data.playersFreshness === "fresh"
                      ? data.players.flatMap((p) =>
                            reportChoice({
                                name: p.name,
                                playerId: p.steamId,
                                team: p.faction,
                            })
                        )
                      : [],
          }
        : empty
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
                const guildPanels = await panels(guild.id)
                const language = guildPanels.length
                    ? await clanLanguageForGuild(guild.id)
                    : undefined
                for (const panel of guildPanels) {
                    const previous = due.get(panel._id)
                    if (
                        previous &&
                        previous.revision === panel.revision &&
                        previous.at > Date.now()
                    )
                        continue
                    try {
                        if (panel.kind === "results")
                            await syncResults(
                                client,
                                panel,
                                cachedIcons,
                                language
                            )
                        else {
                            const current = await live(panel)
                            const hllRead = await hllLiveRead(panel)
                            if (hllRead?.kind === "busy") {
                                // Another reader holds the lease; keep the current card
                                // rather than flickering to the generic layout.
                                due.set(panel._id, {
                                    at:
                                        Date.now() +
                                        Math.min(hllRead.retryAfterMs, 15_000),
                                    revision: panel.revision,
                                })
                                continue
                            }
                            const hll =
                                hllRead?.kind === "ready"
                                    ? hllRead.envelope.data
                                    : null
                            // A banner replaces map artwork; a hidden map uploads nothing.
                            const artwork = panelArtworkWanted(panel)
                                ? await panelArtwork(
                                      panel.gameId,
                                      hll?.status?.map ??
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
                                    ...(hll
                                        ? renderHllPanel(
                                              { ...panel, id: panel._id },
                                              hll,
                                              artwork?.url,
                                              language
                                          )
                                        : renderPanel(
                                              { ...panel, id: panel._id },
                                              panel.snapshot,
                                              current,
                                              cachedIcons,
                                              env.appSiteUrl,
                                              artwork?.url,
                                              language
                                          )),
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
async function syncResults(
    client: Client,
    panel: Panel,
    emoji: FactionIcons,
    language?: string
) {
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
                              {
                                  ...event,
                                  result: event.result,
                                  gameId: panel.gameId,
                                  matchUrl: event.card?.publicMatch
                                      ? buildPublicMatchUrl(event.id, language)
                                      : undefined,
                              },
                              emoji,
                              panel,
                              language
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
    const copy = panelCopy(cachedClanLanguage(interaction.guildId))
    await completePrivatePlayerReply(
        (reply) => interaction.editReply(reply),
        async () => {
            const result = await loadPlayerDetails<Panel, LiveData | HllLive>(
                interaction,
                {
                    readPanel: async (id) =>
                        interaction.guildId
                            ? ((await panels(interaction.guildId)).find(
                                  (p) => p._id === id
                              ) ?? null)
                            : null,
                    readLive: (panel) =>
                        panel.gameId === "hell_let_loose"
                            ? hllLive(panel)
                            : live(panel),
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
                    content: copy.panelChanged,
                    components: [],
                }
            const language = await clanLanguageForGuild(result.panel.guildId)
            if ("statusFreshness" in result.data)
                return renderHllPlayers(
                    {
                        id: result.panel._id,
                        revision: result.panel.revision,
                        presentation: result.panel.presentation,
                    },
                    result.data,
                    result.page,
                    language
                )
            return renderPlayers(
                {
                    id: result.panel._id,
                    revision: result.panel.revision,
                    presentation: result.panel.presentation,
                },
                result.data,
                result.page,
                language
            )
        },
        undefined,
        copy.detailsUnavailable
    )
    return true
}
