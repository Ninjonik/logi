/**
 * The layout of the `/stats` reply in Discord: the parts the bot renders and
 * the dashboard previews (design G3), so the preview cannot drift from the
 * real reply. Discord builders stay in the bot.
 */
import type { StatsGame, StatsPeriod } from "./player-stats"
import type { statsCopy } from "./stats-copy"

export type StatsCopy = ReturnType<typeof statsCopy>

const METRICS = ["kills", "deaths", "cashDelta", "seconds"] as const
type MetricKey = (typeof METRICS)[number]

/** What the Wardogs overview needs from a player's recorded games. */
export type WardogsOverviewPlayer = {
    matches: number
    wins: number
    winRate: number | null
    unknownResults: number
    kd: number | null
    metrics: Record<MetricKey, { value: number | null; knownGames: number }>
}

/** Numbers as the reply shows them: the reader's separators, two decimals, "—" when unknown. */
export function statsNumber(locale: string) {
    const format = new Intl.NumberFormat(
        locale.startsWith("cs")
            ? "cs-CZ"
            : locale.startsWith("de")
              ? "de-DE"
              : "en-GB",
        { maximumFractionDigits: 2 }
    )
    return (value: number | null | undefined) =>
        value === null || value === undefined ? "—" : format.format(value)
}

/** "30 d" or the whole recorded history. */
export function statsPeriodLabel(copy: StatsCopy, period: StatsPeriod) {
    return period === "all" ? copy.all : `${period.slice(0, -1)} d`
}

/** "WARDOGS · Player", at most 256 characters. */
export function statsTitle(game: StatsGame, name: string) {
    return `${game === "wardogs" ? "WARDOGS" : "HELL LET LOOSE"} · ${name}`.slice(
        0,
        256
    )
}

/** Footer naming the data source. */
export function statsFooter(copy: StatsCopy, game: StatsGame) {
    return game === "hll"
        ? `HLL Records · ${copy.hllCoverage}`
        : `Logi / Warcon · ${copy.recorded}`
}

/**
 * Fields of the Wardogs overview: combat, record, cash and playtime, and the
 * metric coverage when some games lack a metric (values marked with *).
 */
export function wardogsOverviewFields(
    copy: StatsCopy,
    player: WardogsOverviewPlayer,
    n: (value: number | null | undefined) => string
): Array<{ name: string; value: string }> {
    const m = player.metrics
    const metric = (key: MetricKey) =>
        `${n(key === "seconds" && m[key].value !== null ? m[key].value! / 3600 : m[key].value)}${m[key].knownGames < player.matches && m[key].value !== null ? "*" : ""}`
    const fields = [
        {
            name: `🎯 ${copy.combat}`,
            value: `${copy.kills} **${metric("kills")}** · ${copy.deaths} **${metric("deaths")}**\nK/D **${n(player.kd)}**`,
        },
        {
            name: `🏆 ${copy.record}`,
            value: `${copy.wins} **${player.wins}/${player.matches}** · ${copy.winRate} **${n(player.winRate === null ? null : player.winRate * 100)} %**\n${copy.unknownResults}: ${player.unknownResults}`,
        },
        {
            name: `💰 ${copy.economy}`,
            value: `${copy.cash} **${metric("cashDelta")}** · ${copy.time} **${metric("seconds")} h**`,
        },
    ]
    const incomplete = METRICS.filter(
        (key) => m[key].knownGames < player.matches
    )
    if (incomplete.length)
        fields.push({
            name: copy.coverage,
            value: incomplete
                .map((key) => `${key}: ${m[key].knownGames}/${player.matches}`)
                .join(" · "),
        })
    return fields
}

export type StatsReplyButton = {
    action:
        | "overview"
        | "refresh"
        | "recent"
        | "factions"
        | "weapons"
        | "maps"
        | "link"
        | "share"
    label: string
    primary?: boolean
}

/**
 * The reply's buttons in rows: navigation, then the requester's actions. The
 * HLL Records link button is added by the bot for HLL replies.
 */
export function statsReplyButtons(
    copy: StatsCopy,
    input: {
        game: StatsGame
        /** The reply shows statistics that can be shared. */
        publishable: boolean
        /** The requester looks at their own statistics. */
        self: boolean
        shared: boolean
    }
): StatsReplyButton[][] {
    const navigation: StatsReplyButton[] = [
        { action: "overview", label: copy.overview },
        { action: "refresh", label: copy.refresh },
    ]
    if (input.publishable)
        navigation.push(
            { action: "recent", label: copy.recent },
            input.game === "hll"
                ? { action: "weapons", label: copy.weapons }
                : { action: "factions", label: copy.factions }
        )
    if (input.publishable && input.game === "hll")
        navigation.push({ action: "maps", label: copy.maps })
    const actions: StatsReplyButton[] = []
    if (input.self) actions.push({ action: "link", label: copy.add })
    if (input.publishable && !input.shared)
        actions.push({ action: "share", label: copy.share, primary: true })
    return actions.length ? [navigation, actions] : [navigation]
}
