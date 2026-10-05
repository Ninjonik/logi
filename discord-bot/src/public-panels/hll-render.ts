import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    MessageFlags,
    escapeMarkdown,
    EmbedBuilder,
    type MessageCreateOptions,
} from "discord.js"
import {
    factionEmojiFor,
    panelAccentColor,
    panelBannerImage,
    resolvePanelPresentation,
    type PanelPresentationCarrier,
    type ResolvedPanelPresentation,
} from "../../../src/domain/discord-publications/panel-presentation"
import {
    hllLeaders,
    type HllLive,
} from "../../../src/domain/game-data/hll-live"
import { panelCopy, type PanelCopy } from "./copy"
import { playerControl } from "./player-details"
import { bannerGallery } from "./render"

const clean = (value: string | null, max = 80) =>
    escapeMarkdown(
        (value ?? "—")
            .replace(/@/g, "＠")
            .replace(/[\r\n<>]/g, " ")
            .slice(0, max)
    )
const metric = (value: number | null) => (value === null ? "—" : String(value))
const at = (value: string | null, copy: PanelCopy) =>
    value ? `<t:${Math.floor(Date.parse(value) / 1000)}:R>` : copy.unknownTime
const team = (value: string | null, copy: PanelCopy) =>
    value === "allies"
        ? copy.hllAllies
        : value === "axis"
          ? copy.hllAxis
          : copy.hllUnknownTeam
/** Workspace emoji override before a team label; HLL teams have no default emoji. */
const teamMark = (
    look: Pick<ResolvedPanelPresentation, "factionEmoji">,
    value: string | null
) => {
    const emoji =
        value === "allies" || value === "axis"
            ? factionEmojiFor(look, value)
            : null
    return emoji ? `${emoji} ` : ""
}
type Panel = PanelPresentationCarrier & {
    id: string
    revision: number
    enabled: boolean
    showLeaders?: boolean
    showPlayers: boolean
    reportCategoryId?: string
}
export function renderHllPanel(
    panel: Panel,
    data: HllLive,
    artwork?: string,
    language?: string
): MessageCreateOptions {
    const copy = panelCopy(language)
    const look = resolvePanelPresentation(panel)
    const { layout } = look
    // The accent replaces the live color; stale and paused cards keep the warning.
    const box = new ContainerBuilder().setAccentColor(
        panel.enabled && data.statusFreshness === "fresh"
            ? panelAccentColor(look, 0x77b255)
            : 0xd99a37
    )
    const remaining = copy.hllRemaining(
        data.status?.timeRemainingSeconds == null
            ? "—"
            : `${Math.floor(data.status.timeRemainingSeconds / 60)}m ${Math.floor(data.status.timeRemainingSeconds % 60)}s`
    )
    const players = copy.playerCount(
        metric(data.status?.playerCount ?? null),
        metric(data.status?.maxPlayers ?? null)
    )
    const mapLine = `🗺️ **${clean(data.status?.map ?? null)}**`
    const state = panel.enabled
        ? copy.hllCurrentRound(copy.freshness(data.statusFreshness))
        : copy.paused
    const server = clean(data.status?.serverName ?? null)
    const header = new TextDisplayBuilder().setContent(
        layout.compact
            ? `**HELL LET LOOSE · ${server}**\n-# ${[
                  state,
                  ...(panel.enabled
                      ? [
                            layout.showMap ? mapLine : null,
                            layout.showPlayerCount ? players : null,
                            remaining,
                        ]
                      : []),
              ]
                  .filter((part): part is string => part !== null)
                  .join(" · ")}`
            : `### HELL LET LOOSE · ${copy.serverLive}\n**${server}**\n${state}${panel.enabled ? `${layout.showMap ? `\n${mapLine}` : ""}\n${layout.showPlayerCount ? `${players} · ` : ""}${remaining}` : ""}`
    )
    const banner = panelBannerImage(look)
    if (banner) box.addMediaGalleryComponents(bannerGallery(banner, copy))
    // A banner replaces the map thumbnail; hiding the map hides its artwork.
    if (!banner && layout.showMap && artwork?.startsWith("attachment://"))
        box.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(header)
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL(artwork)
                        .setDescription(clean(data.status?.map ?? null))
                )
        )
    else box.addTextDisplayComponents(header)
    if (panel.enabled) {
        if (layout.showScoreboard) {
            if (!layout.compact)
                box.addSeparatorComponents(new SeparatorBuilder())
            const rows = (data.status?.scores ?? []).map((score) => {
                const leader = panel.showLeaders
                    ? hllLeaders(data.players, score.team)[0]
                    : null
                return `${teamMark(look, score.team)}**${team(score.team, copy)} · ${score.score}**${panel.showLeaders ? `\n-# ⚔ ${leader ? `${clean(leader.name, 28)} · ${metric(leader.kills)} ${copy.kills}` : copy.hllNoLeader}` : ""}`
            })
            const observed = copy.statusObserved(at(data.statusAt, copy))
            box.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    layout.compact
                        ? `${rows.join(panel.showLeaders ? "\n" : "  ·  ") || copy.scoresUnavailable}\n-# ${observed}`
                        : `**${copy.teamScore}**\n${rows.join("\n\n") || copy.scoresUnavailable}\n-# ${observed}`
                )
            )
        }
        if (panel.showLeaders) {
            if (!layout.compact)
                box.addSeparatorComponents(new SeparatorBuilder())
            box.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${copy.topKills}\n${
                        hllLeaders(data.players)
                            .map(
                                (p, i) =>
                                    `${["🥇", "🥈", "🥉"][i]} **${clean(p.name, 28)}** · **${metric(p.kills)}** ${copy.kills} · ${teamMark(look, p.team)}${team(p.team, copy)}`
                            )
                            .join("\n") ||
                        (data.playersFreshness === "fresh"
                            ? copy.noConnectedPlayers
                            : copy.playerDataUnavailable)
                    }\n-# ${copy.hllPlayersFooter(copy.freshness(data.playersFreshness), at(data.playersAt, copy))}`
                )
            )
        }
        if (panel.showPlayers)
            box.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            playerControl(panel.id, panel.revision, 0, "open")
                        )
                        .setLabel(copy.playersButton)
                        .setStyle(ButtonStyle.Secondary)
                )
            )
    }
    if (panel.enabled && panel.reportCategoryId)
        box.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`report:open:${panel.id}:${panel.revision}`)
                    .setLabel(copy.reportButton)
                    .setStyle(ButtonStyle.Danger)
            )
        )
    return {
        components: [box],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    }
}
export function renderHllPlayers(
    panel: PanelPresentationCarrier & { id: string; revision: number },
    data: HllLive,
    requestedPage: number,
    language?: string
) {
    const copy = panelCopy(language)
    const size = 8,
        pages = Math.max(1, Math.ceil(data.players.length / size)),
        page = Math.max(0, Math.min(requestedPage, pages - 1))
    const look = resolvePanelPresentation(panel)
    const embed = new EmbedBuilder()
        .setColor(panelAccentColor(look, 0x5865f2))
        .setTitle(copy.hllPlayersTitle)
        .setDescription(
            `**${clean(data.status?.map ?? null)}**\n${copy.hllPlayersSummary(copy.freshness(data.playersFreshness), at(data.playersAt, copy), page + 1, pages)}\n\n${
                data.players
                    .slice(page * size, (page + 1) * size)
                    .map(
                        (p) =>
                            `**${clean(p.name, 40)}** · ${teamMark(look, p.team)}${team(p.team, copy)}\n⚔ ${metric(p.kills)} ${copy.kills} · ☠ ${metric(p.deaths)} ${copy.deaths}\n${copy.hllPlayerStats(
                                {
                                    combat: metric(p.combat),
                                    offense: metric(p.offense),
                                    defense: metric(p.defense),
                                    support: metric(p.support),
                                }
                            )}`
                    )
                    .join("\n\n") ||
                (data.playersFreshness === "fresh"
                    ? copy.noConnectedPlayers
                    : copy.playerDataUnavailable)
            }`
        )
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(
                playerControl(
                    panel.id,
                    panel.revision,
                    Math.max(0, page - 1),
                    "previous"
                )
            )
            .setLabel(copy.previous)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(
                playerControl(
                    panel.id,
                    panel.revision,
                    Math.min(pages - 1, page + 1),
                    "next"
                )
            )
            .setLabel(copy.next)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === pages - 1)
    )
    return {
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: [] },
    }
}
