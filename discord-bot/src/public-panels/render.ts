import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MessageFlags,
    TextDisplayBuilder,
    escapeMarkdown,
    type MessageCreateOptions,
} from "discord.js"
import type { WarconRead } from "../../../src/domain/game-data/warcon-contracts"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
export type LiveData = Extract<WarconRead, { view: "live" }>["data"]
type Panel = {
    id: string
    gameId: string
    enabled: boolean
    showPlayers: boolean
    artwork: boolean
}
export type FactionIcons = Partial<
    Record<"valkyra" | "manticore" | "lonestar", string>
>
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
export function factionIcon(name: string, icons: FactionIcons) {
    switch (name.trim().toLowerCase()) {
        case "valkyra":
            return icons.valkyra ?? "◈"
        case "manticore":
            return icons.manticore ?? "◈"
        case "lonestar":
            return icons.lonestar ?? "◈"
        default:
            return "◈"
    }
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
          ? "/img/games/hll.jpg"
          : null
}
export function renderPanel(
    panel: Panel,
    snapshot: ServerSnapshot | null,
    live: LiveData | null,
    icons: FactionIcons = {},
    assetOrigin?: string
): MessageCreateOptions {
    const status = live?.status
    const map = status?.map ?? snapshot?.map
    const age = live ? live.freshness : (snapshot?.freshness ?? "unavailable")
    const label = panel.enabled
        ? age === "fresh"
            ? "Live · score in progress"
            : `${age} · last known data`
        : "Paused · automatic updates disabled"
    const container = new ContainerBuilder().setAccentColor(
        panel.enabled && age === "fresh" ? 0x77b255 : 0xd99a37
    )
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### ${panel.gameId === "wardogs" ? "WARDOGS" : "HELL LET LOOSE"}\n**${clean(status?.serverName ?? snapshot?.displayName)}**\n${label}`
        )
    )
    const art = panel.artwork && artworkPath(panel.gameId, map)
    if (art && assetOrigin?.startsWith("https://"))
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems((item) =>
                item
                    .setURL(new URL(art, assetOrigin).href)
                    .setDescription(clean(map ?? "Game artwork"))
            )
        )
    if (panel.enabled) {
        const scores =
            status?.scores.map((s) => ({ label: s.name, score: s.score })) ??
            snapshot?.scores ??
            []
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🗺️ **${clean(map)}**\n👥 **${count(status?.playerCount ?? snapshot?.players)} / ${count(status?.maxPlayers ?? snapshot?.capacity)}** players\n${
                    scores
                        .slice(0, 8)
                        .map(
                            (s) =>
                                `${factionIcon(s.label, icons)} **${clean(s.label, 40)}** · ${count(s.score)}`
                        )
                        .join("\n") || "Scores unavailable"
                }\n-# Observed ${at(live?.statusAt ?? snapshot?.observedAt)}`
            )
        )
        if (panel.showPlayers && live)
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`logi:players:${panel.id}:0`)
                        .setLabel("Players · private details")
                        .setStyle(ButtonStyle.Secondary)
                )
            )
    }
    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    }
}
export function renderPlayers(
    panelId: string,
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
            .setCustomId(`logi:players:${panelId}:${Math.max(0, page - 1)}`)
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(
                `logi:players:${panelId}:${Math.min(pages - 1, page + 1)}`
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
    icons: FactionIcons = {}
): MessageCreateOptions {
    const result = event.result
    const container = new ContainerBuilder()
        .setAccentColor(0x77b255)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### ${result.status === "corrected" ? "Corrected" : "Confirmed"} result · v${result.version}\n**${clean(event.name)}**\n🗺️ ${clean(event.map)}\n${result.participants
                    .slice(0, 16)
                    .map(
                        (p) =>
                            `${factionIcon(p.label, icons)} **${clean(p.label, 60)}** · ${count(p.score)}`
                    )
                    .join("\n")}\n-# Reviewed ${at(result.reviewedAt)}`
            )
        )
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        allowedMentions: { parse: [] },
    }
}
