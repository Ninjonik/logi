import {
    statsFooter,
    statsNumber,
    statsPeriodLabel,
    statsTitle,
    wardogsOverviewFields,
} from "../../../src/domain/player-stats/stats-reply"
import type {
    StatsGame,
    StatsPeriod,
} from "../../../src/domain/player-stats/player-stats"
import type { PlayerStatsResult } from "../../../src/application/game-data/read-player-stats"
import { statsCopy } from "../../../src/domain/player-stats/stats-copy"
import { EmbedBuilder, escapeMarkdown } from "discord.js"

export type StatsView = "overview" | "recent" | "factions" | "weapons" | "maps"
export const safeStatsText = (value: string) =>
    escapeMarkdown(
        value.replace(/@/g, "＠").replace(/[\u0000-\u001f\u007f]/g, " ")
    ).slice(0, 250)
export function renderStats(input: {
    game: StatsGame
    period: StatsPeriod
    locale: string
    result: PlayerStatsResult
    view?: StatsView
    self?: boolean
    imageUrl?: string
}) {
    const c = statsCopy(input.locale),
        r = input.result,
        view = input.view ?? "overview"
    const n = statsNumber(input.locale)
    const period = statsPeriodLabel(c, input.period)
    const title =
        r.kind === "wardogs"
            ? (r.stats?.player.name ?? r.name)
            : r.kind === "hll"
              ? (r.read.profile?.name ?? r.name)
              : r.account.name
    const embed = new EmbedBuilder()
        .setColor(input.game === "wardogs" ? 0xd8a846 : 0x75865b)
        .setTitle(statsTitle(input.game, safeStatsText(title ?? "Player")))
        .setDescription(`**${period}**`)
        .setFooter({ text: statsFooter(c, input.game) })
    if (input.imageUrl) embed.setThumbnail(input.imageUrl)
    const field = (name: string, value: string, inline = false) =>
        embed.addFields({ name, value: value.slice(0, 1024) || "—", inline })
    if (r.kind === "missing_link" || r.kind === "ambiguous_link")
        embed.setDescription(
            r.kind === "missing_link"
                ? input.self
                    ? `${c.missing}\n${c.declared}`
                    : c.otherMissing
                : input.self
                  ? `${c.ambiguous}\n${c.declared}`
                  : c.otherAmbiguous
        )
    else if (r.kind === "hll") {
        const p = r.read.profile
        if (r.read.status === "unavailable")
            embed.setDescription(
                r.read.reason === "blocked" ? c.blocked : c.unavailable
            )
        else if (r.read.status === "empty") embed.setDescription(c.empty)
        else if (p) {
            if (r.read.status === "stale")
                embed.setDescription(`**${period}**\n⚠️ ${c.stale}`)
            if (view === "recent")
                field(
                    c.recent,
                    p.recent
                        .map(
                            (g) =>
                                `[${safeStatsText(g.label).slice(0, 170)}](${g.url})`
                        )
                        .join("\n") || c.noItems
                )
            else if (view === "weapons" || view === "maps")
                field(
                    c[view],
                    p[view].map(safeStatsText).join("\n") || c.noItems
                )
            else {
                field(
                    `🎯 ${c.combat}`,
                    `${c.kills} **${n(p.kills)}** · ${c.deaths} **${n(p.deaths)}**\nK/D **${n(p.kd)}** · TK **${n(p.teamKills)}**`
                )
                field(
                    `⏱️ ${c.record}`,
                    `${c.matches} **${n(p.matches)}${p.lowerBound && p.matches !== null ? "+" : ""}** · ${c.time} **${n(p.hours)}${p.lowerBound && p.hours !== null ? "+" : ""} h**\nInfantry ELO **${n(p.elo)}**`
                )
                if (p.formWinRate !== null)
                    field(
                        c.form,
                        `${c.winRate} **${n(p.formWinRate)} %**\n${c.formScope}`
                    )
            }
        }
        if (r.read.fetchedAt) embed.setTimestamp(new Date(r.read.fetchedAt))
    } else {
        const stats = r.stats
        if (!stats) embed.setDescription(c.empty)
        else if (view === "recent")
            field(
                c.recent,
                stats.recent
                    .map(
                        (g) =>
                            `${g.result === "win" ? "✅" : g.result === "loss" ? "❌" : g.result === "draw" ? "🤝" : "❔"} **${safeStatsText(g.map ?? "—")}** · <t:${Math.floor(Date.parse(g.endedAt) / 1000)}:d>\n${n(g.metrics.kills)} K / ${n(g.metrics.deaths)} D · ${safeStatsText(g.server ?? "—")}`
                    )
                    .join("\n\n")
            )
        else if (view === "factions")
            field(
                c.factions,
                stats.factions
                    .map(
                        (f) =>
                            `${f.name.toLowerCase() === "valkyra" ? "🟥" : f.name.toLowerCase() === "manticore" ? "🟩" : f.name.toLowerCase() === "lonestar" ? "🟦" : "◻️"} **${safeStatsText(f.name)}** · ${f.wins}/${f.matches} ${c.wins.toLowerCase()} · ${n(f.kills)} K`
                    )
                    .join("\n") || c.noItems
            )
        else
            for (const item of wardogsOverviewFields(c, stats.player, n))
                field(item.name, item.value)
        if (r.fetchedAt) embed.setTimestamp(new Date(r.fetchedAt))
    }
    return { embeds: [embed], allowedMentions: { parse: [] as never[] } }
}
