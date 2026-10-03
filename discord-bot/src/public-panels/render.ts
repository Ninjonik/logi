import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    MessageFlags,
    TextDisplayBuilder,
    escapeMarkdown,
    type MessageCreateOptions,
} from "discord.js"
import type { WarconRead } from "../../../src/domain/game-data/warcon-contracts"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { playerLeaders } from "../../../src/domain/game-data/player-leaders"
import { playerControl } from "./player-details"
export type LiveData = Extract<WarconRead, { view: "live" }>["data"]
type Panel = {
    id: string
    revision: number
    gameId: string
    enabled: boolean
    showPlayers: boolean
    showLeaders?: boolean
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
export function factionIcon(name: string | null, icons: FactionIcons) {
    switch (name?.trim().toLowerCase()) {
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
    assetOrigin?: string,
    attachmentUrl?: string
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
    const header = new TextDisplayBuilder().setContent(
        `### ${panel.gameId === "wardogs" ? "WARDOGS" : "HELL LET LOOSE"} · SERVER LIVE\n**${clean(status?.serverName ?? snapshot?.displayName)}**\n${label}${panel.enabled ? `\n🗺️ **${clean(map)}**  ·  👥 **${count(status?.playerCount ?? snapshot?.players)} / ${count(status?.maxPlayers ?? snapshot?.capacity)}** players` : ""}`
    )
    const art = panel.artwork && artworkPath(panel.gameId, map)
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
        const scores =
            status?.scores.map((s) => ({ label: s.name, score: s.score })) ??
            snapshot?.scores ??
            []
        container.addSeparatorComponents(new SeparatorBuilder())
        const teamRows = scores.slice(0, 8).map((s) => {
            const score = `${factionIcon(s.label, icons)} **${clean(s.label, 40)}** · **${count(s.score)}** pts`
            if (!panel.showLeaders || !live) return score
            const kills = playerLeaders(live.players, "kills", s.label)[0]
            const cash = playerLeaders(live.players, "cash", s.label)[0]
            return `${score}\n-# ⚔ ${kills ? `${clean(kills.name, 28)} · ${count(kills.kills)} kills` : "—"}  |  💵 ${cash ? `${clean(cash.name, 28)} · ${count(cash.cash)} cash` : "—"}`
        })
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**FACTION SCORE${panel.showLeaders && live ? " & TEAM LEADERS" : ""}**\n${teamRows.join("\n\n") || "Scores unavailable"}\n-# Score observed ${at(live?.statusAt ?? snapshot?.observedAt)}`
            )
        )
        if (panel.showLeaders && live) {
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
                        `### ${metric === "kills" ? "⚔ TOP 3 · Kills" : "💵 TOP 3 · Cash"}\n${leaders.map((p, i) => `${["🥇", "🥈", "🥉"][i]} **${clean(p.name, 28)}** · **${count(p[metric])}** ${metric} · ${factionIcon(p.faction, icons)} ${clean(p.faction, 20)}`).join("\n") || (live.playersFreshness === "fresh" ? "No players reported." : "Player data unavailable.")}`
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
