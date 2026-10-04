import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SectionBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    MessageFlags,
    TextDisplayBuilder,
    escapeMarkdown,
    type MessageCreateOptions,
} from "discord.js"
import {
    NEUTRAL_FACTION_MARKER,
    panelAccentColor,
    panelBannerImage,
    panelFactionIcons,
    panelFactionOf,
    resolvePanelPresentation,
    type PanelFactionEmoji,
    type PanelPresentationCarrier,
} from "../../../src/domain/discord-publications/panel-presentation"
import type { WarconRead } from "../../../src/domain/game-data/warcon-contracts"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { playerLeaders } from "../../../src/domain/game-data/player-leaders"
import { hllMapArtwork } from "../../../src/domain/game-data/hll-live"
import { playerControl } from "./player-details"
export type LiveData = Extract<WarconRead, { view: "live" }>["data"]
type Panel = PanelPresentationCarrier & {
    id: string
    revision: number
    gameId: string
    enabled: boolean
    showPlayers: boolean
    showLeaders?: boolean
    reportCategoryId?: string
    artwork: boolean
}
/** Runtime defaults (installed application emoji) and workspace overrides per faction. */
export type FactionIcons = PanelFactionEmoji
const clean = (value: string | null | undefined, max = 100) =>
    escapeMarkdown(
        (value ?? "—")
            .replace(/@/g, "＠")
            .replace(/[\r\n<>]/g, " ")
            .slice(0, max)
    )
const count = (value: number | null | undefined) =>
    value == null ? "—" : String(value)
const at = (value: string | null | undefined) =>
    value && Number.isFinite(Date.parse(value))
        ? `<t:${Math.floor(Date.parse(value) / 1000)}:R>`
        : "unknown"
/** Semantic faction icon; provider labels such as Alpha/Bravo keep the neutral marker. */
export function factionIcon(name: string | null, icons: FactionIcons) {
    const faction = panelFactionOf(name)
    return (faction ? icons[faction] : undefined) ?? NEUTRAL_FACTION_MARKER
}
/** Packaged map artwork is uploaded only when it will be shown: no banner and a visible map. */
export function panelArtworkWanted(
    panel: PanelPresentationCarrier & { artwork: boolean }
) {
    const look = resolvePanelPresentation(panel)
    return panel.artwork && look.layout.showMap && !panelBannerImage(look)
}
/** Full-width banner image placed above the header. */
export function bannerGallery(url: string) {
    return new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(url).setDescription("Panel banner")
    )
}
export function artworkPath(game: string, map?: string | null) {
    const key = map?.trim().toLowerCase()
    if (
        game === "wardogs" &&
        key &&
        ["bakurani", "ozeti", "zestafona"].includes(key)
    )
        return `/maps/wardogs/${key}.webp`
    return game === "wardogs"
        ? "/img/games/wardogs.jpg"
        : game === "hell_let_loose"
          ? hllMapArtwork(map)
          : null
}
export function renderPanel(
    panel: Panel,
    snapshot: ServerSnapshot | null,
    live: LiveData | null,
    icons: FactionIcons = {},
    assetOrigin?: string,
    attachmentUrl?: string
): MessageCreateOptions {
    const look = resolvePanelPresentation(panel)
    const { layout } = look
    const marks = panelFactionIcons(look, icons)
    const status = live?.status
    const map = status?.map ?? snapshot?.map
    const age = live ? live.freshness : (snapshot?.freshness ?? "unavailable")
    const label = panel.enabled
        ? age === "fresh"
            ? "Live · score in progress"
            : `${age} · last known data`
        : "Paused · automatic updates disabled"
    // The accent replaces the live color; stale and paused cards keep the warning.
    const container = new ContainerBuilder().setAccentColor(
        panel.enabled && age === "fresh"
            ? panelAccentColor(look, 0x77b255)
            : 0xd99a37
    )
    const game = panel.gameId === "wardogs" ? "WARDOGS" : "HELL LET LOOSE"
    const server = clean(status?.serverName ?? snapshot?.displayName)
    const facts = panel.enabled
        ? [
              layout.showMap ? `🗺️ **${clean(map)}**` : null,
              layout.showPlayerCount
                  ? `👥 **${count(status?.playerCount ?? snapshot?.players)} / ${count(status?.maxPlayers ?? snapshot?.capacity)}** players`
                  : null,
          ].filter((fact): fact is string => fact !== null)
        : []
    const header = new TextDisplayBuilder().setContent(
        layout.compact
            ? `**${game} · ${server}**\n-# ${[label, ...facts].join(" · ")}`
            : `### ${game} · SERVER LIVE\n**${server}**\n${label}${facts.length ? `\n${facts.join("  ·  ")}` : ""}`
    )
    const banner = panelBannerImage(look)
    if (banner) container.addMediaGalleryComponents(bannerGallery(banner))
    // A banner replaces the map thumbnail; hiding the map hides its artwork.
    const art =
        !banner &&
        layout.showMap &&
        panel.artwork &&
        artworkPath(panel.gameId, map)
    const image =
        art &&
        (attachmentUrl?.startsWith("attachment://")
            ? attachmentUrl
            : assetOrigin?.startsWith("https://")
              ? new URL(art, assetOrigin).href
              : null)
    if (image)
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(header)
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL(image)
                        .setDescription(clean(map ?? "Game artwork"))
                )
        )
    else container.addTextDisplayComponents(header)
    if (panel.enabled) {
        const withLeaders = Boolean(panel.showLeaders && live)
        if (layout.showScoreboard) {
            const scores =
                status?.scores.map((s) => ({
                    label: s.name,
                    score: s.score,
                })) ??
                snapshot?.scores ??
                []
            if (!layout.compact)
                container.addSeparatorComponents(new SeparatorBuilder())
            const teamRows = scores.slice(0, 8).map((s) => {
                const score = `${factionIcon(s.label, marks)} **${clean(s.label, 40)}** · **${count(s.score)}** pts`
                if (!panel.showLeaders || !live) return score
                const kills = playerLeaders(live.players, "kills", s.label)[0]
                const cash = playerLeaders(live.players, "cash", s.label)[0]
                return `${score}\n-# ⚔ ${kills ? `${clean(kills.name, 28)} · ${count(kills.kills)} kills` : "—"}  |  💵 ${cash ? `${clean(cash.name, 28)} · ${count(cash.cash)} cash` : "—"}`
            })
            const observed = `-# Score observed ${at(live?.statusAt ?? snapshot?.observedAt)}`
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    layout.compact
                        ? `${teamRows.join(withLeaders ? "\n" : "  ·  ") || "Scores unavailable"}\n${observed}`
                        : `**FACTION SCORE${withLeaders ? " & TEAM LEADERS" : ""}**\n${teamRows.join("\n\n") || "Scores unavailable"}\n${observed}`
                )
            )
        }
        if (live && withLeaders) {
            if (!layout.compact)
                container.addSeparatorComponents(new SeparatorBuilder())
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**LIVE LEADERS · ${live.playersFreshness}**\n-# Current connected players · observed ${at(live.playersAt)}`
                )
            )
            for (const metric of ["kills", "cash"] as const) {
                const leaders = playerLeaders(live.players, metric)
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### ${metric === "kills" ? "⚔ TOP 3 · Kills" : "💵 TOP 3 · Cash"}\n${leaders.map((p, i) => `${["🥇", "🥈", "🥉"][i]} **${clean(p.name, 28)}** · **${count(p[metric])}** ${metric} · ${factionIcon(p.faction, marks)} ${clean(p.faction, 20)}`).join("\n") || (live.playersFreshness === "fresh" ? "No players reported." : "Player data unavailable.")}`
                    )
                )
            }
        }
        if (panel.showPlayers && live)
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            playerControl(panel.id, panel.revision, 0, "open")
                        )
                        .setLabel("Players · private details")
                        .setStyle(ButtonStyle.Secondary)
                )
            )
    }
    if (panel.enabled && panel.reportCategoryId)
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`report:open:${panel.id}:${panel.revision}`)
                    .setLabel("Report Player")
                    .setStyle(ButtonStyle.Danger)
            )
        )
    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    }
}
export function renderPlayers(
    panel: { id: string; revision: number },
    live: LiveData,
    requestedPage: number
) {
    const size = 8
    const pages = Math.max(1, Math.ceil(live.players.length / size))
    const page = Math.max(0, Math.min(Math.floor(requestedPage), pages - 1))
    const rows = live.players
        .slice(page * size, (page + 1) * size)
        .map(
            (p) =>
                `**${clean(p.name, 45)}** · ${clean(p.faction, 20)}\n⚔ ${p.kills} kills · ☠ ${p.deaths} deaths · 💵 ${p.cash} cash · 📶 ${count(p.ping)} ms`
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
            .setLabel("Previous")
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
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === pages - 1)
    )
    return {
        content: `**Players · ${live.playersFreshness} · ${page + 1}/${pages}**\nObserved ${at(live.playersAt)}\n${rows.join("\n\n") || (live.playersFreshness === "fresh" ? "No players reported." : "Player data unavailable.")}`,
        components: [row],
        allowedMentions: { parse: [] as never[] },
    }
}
export function renderResult(
    event: {
        id: string
        name: string
        map: string | null
        result: {
            status: string
            version: number
            reviewedAt: string | null
            participants: { label: string; score: number | null }[]
        }
    },
    icons: FactionIcons = {},
    panel?: PanelPresentationCarrier
): MessageCreateOptions {
    const result = event.result
    const look = resolvePanelPresentation(panel)
    const { layout } = look
    const marks = panelFactionIcons(look, icons)
    const container = new ContainerBuilder().setAccentColor(
        panelAccentColor(look, 0x77b255)
    )
    const banner = panelBannerImage(look)
    if (banner) container.addMediaGalleryComponents(bannerGallery(banner))
    const title = `${result.status === "corrected" ? "Corrected" : "Confirmed"} result · v${result.version}`
    const rows = result.participants
        .slice(0, 16)
        .map(
            (p) =>
                `${factionIcon(p.label, marks)} **${clean(p.label, 60)}** · ${count(p.score)}`
        )
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            layout.compact
                ? `**${title} · ${clean(event.name)}**${layout.showMap ? `\n-# 🗺️ ${clean(event.map)}` : ""}\n${rows.join("  ·  ")}\n-# Reviewed ${at(result.reviewedAt)}`
                : `### ${title}\n**${clean(event.name)}**${layout.showMap ? `\n🗺️ ${clean(event.map)}` : ""}\n${rows.join("\n")}\n-# Reviewed ${at(result.reviewedAt)}`
        )
    )
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        allowedMentions: { parse: [] },
    }
}
