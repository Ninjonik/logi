/**
 * The `/stats` card in Discord (board M2 1.2) as a framework-free message
 * view: the bot sends it through the message kit and the "Příkazy" page
 * previews the same view with example data (N3-14), so the two cannot drift.
 */
import {
    errorCard,
    escapeMarkdownText,
    type ChipTone,
    type MessageBlock,
    type MessageButton,
    type MessageView,
} from "../discord-messages/message-view"
import {
    discordTimestamp,
    discordWeekdayTimestamp,
    fillTemplate,
    formatCount,
} from "../discord-messages/format"
import type {
    HllProfile,
    StatsGame,
    StatsPeriod,
    WardogsPlayerStats,
} from "./player-stats"
import type { PanelFactionEmoji } from "../discord-publications/panel-presentation"
import { czechFrom, shortDay, userMention } from "../discord-commands/text"
import { factionEmblem } from "../discord-messages/faction-emblem"
import { chipText } from "../discord-messages/message-layout"
import type { StatsCopy } from "./stats-copy"

export type { StatsCopy } from "./stats-copy"

export type StatsView = "overview" | "recent" | "factions" | "weapons" | "maps"

/** The read of `/stats` (structurally `PlayerStatsResult`). */
export type StatsResultData =
    | { kind: "missing_link"; account: { name: string | null } }
    | { kind: "ambiguous_link"; account: { name: string | null } }
    | {
          kind: "hll"
          steamId: string
          name: string | null
          read: {
              status: "ok" | "stale" | "empty" | "unavailable"
              profile: HllProfile | null
              fetchedAt: string | null
              reason: string | null
          }
      }
    | {
          kind: "wardogs"
          steamId: string
          name: string | null
          stats: WardogsPlayerStats | null
          fetchedAt: string | null
      }

/** The buttons of a private card: `id(action)` builds each custom ID. */
export type StatsControls = {
    id: (action: StatsButtonAction) => string
    /** Sdílet is offered (reply mode "Jen autor, s tlačítkem Sdílet"). */
    share: boolean
}

export type StatsButtonAction =
    "overview" | "recent" | "factions" | "weapons" | "maps" | "share" | "link"

export type StatsViewInput = {
    copy: StatsCopy
    /** The clan language's Intl locale (`cs-CZ`, …). */
    locale: string
    timeZone?: string
    game: StatsGame
    period: StatsPeriod
    result: StatsResultData
    view: StatsView
    /** The person looks at their own statistics. */
    self: boolean
    /** The private card's buttons; omitted on the shared card. */
    controls?: StatsControls
    /** The shared card names who shared it and the data time. */
    shared?: { userId: string; at: string | number }
    /** Installed faction application emoji; fallbacks otherwise. */
    factionEmoji?: PanelFactionEmoji
    /** The public HLL Records profile, for the HLL link button. */
    hllProfileUrl?: string
}

/** Numbers in the clan language: "1 284", "1,37"; "—" when unknown. */
export function statsNumber(locale: string, maximumFractionDigits = 2) {
    const format = new Intl.NumberFormat(locale, { maximumFractionDigits })
    return (value: number | null | undefined) =>
        value === null || value === undefined || !Number.isFinite(value)
            ? "—"
            : format.format(value)
}

const plainName = (value: string | null | undefined, fallback: string) =>
    (value ?? "")
        .replace(/[\p{Cc}\p{Cf}]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || fallback

/** Markdown-safe provider text without pings. */
const safe = (value: string, max = 100) =>
    escapeMarkdownText(
        value
            .replace(/[\p{Cc}\p{Cf}]/gu, " ")
            .replace(/@/g, "@​")
            .trim()
            .slice(0, max)
    )

/** The person's display name for the title. */
export function statsPlayerName(
    result: StatsResultData,
    fallback: string
): string {
    if (result.kind === "wardogs")
        return plainName(result.stats?.player.name ?? result.name, fallback)
    if (result.kind === "hll")
        return plainName(result.read.profile?.name ?? result.name, fallback)
    return plainName(result.account.name, fallback)
}

/** "WARDOGS · POSLEDNÍCH 30 DNÍ" (laid out upper case). */
function statsLabel(copy: StatsCopy, game: StatsGame, period: StatsPeriod) {
    return `${copy.games[game]} · ${copy.periodLabels[period]}`
}

const METRICS = ["kills", "deaths", "cashDelta", "seconds"] as const
type Metric = (typeof METRICS)[number]

/**
 * "Zabití a K/D známe z 21 z 23 her." for metrics some games lack (M2-B04),
 * one sentence per coverage.
 */
export function statsCoverageLines(
    copy: StatsCopy,
    locale: string,
    player: {
        matches: number
        metrics: Record<Metric, { value: number | null; knownGames: number }>
    }
) {
    const n = statsNumber(locale, 0)
    const groups = new Map<number, Metric[]>()
    for (const metric of METRICS) {
        const known = player.metrics[metric].knownGames
        if (known >= player.matches) continue
        groups.set(known, [...(groups.get(known) ?? []), metric])
    }
    return [...groups].map(([known, metrics]) => {
        const names: string[] = []
        if (metrics.includes("kills") && metrics.includes("deaths"))
            names.push(copy.coverageNames.killsKd)
        else {
            if (metrics.includes("kills")) names.push(copy.coverageNames.kills)
            if (metrics.includes("deaths"))
                names.push(copy.coverageNames.deaths)
        }
        if (metrics.includes("cashDelta"))
            names.push(copy.coverageNames.cashDelta)
        if (metrics.includes("seconds")) names.push(copy.coverageNames.seconds)
        const joined =
            names.length > 1
                ? `${names.slice(0, -1).join(", ")}, ${names[names.length - 1]}`
                : names[0]!
        return fillTemplate(copy.coverage, {
            metrics: joined,
            known: n(known),
            total: n(player.matches),
            from: czechFrom(known),
            fromTotal: czechFrom(player.matches),
        })
    })
}

function hours(locale: string, seconds: number | null) {
    if (seconds === null) return null
    const value = seconds / 3600
    return statsNumber(locale, value >= 10 ? 0 : 1)(value)
}

function signed(locale: string, value: number | null) {
    if (value === null) return "—"
    const text = statsNumber(locale, 0)(Math.abs(value))
    return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}

/** The Wardogs overview (M2-12..14): tiles, detail line, coverage. */
function wardogsOverview(
    input: StatsViewInput,
    stats: WardogsPlayerStats
): MessageBlock[] {
    const { copy, locale } = input
    const n = statsNumber(locale)
    const whole = statsNumber(locale, 0)
    const player = stats.player
    const m = player.metrics
    const detail = [
        player.winRate === null
            ? undefined
            : fillTemplate(copy.winRate, {
                  rate: whole(player.winRate * 100),
              }),
        m.seconds.value === null
            ? undefined
            : fillTemplate(copy.playtime, {
                  hours: hours(locale, m.seconds.value) ?? "—",
              }),
        m.cashDelta.value === null
            ? undefined
            : fillTemplate(copy.cash, {
                  cash: signed(locale, m.cashDelta.value),
              }),
    ].filter((part): part is string => Boolean(part))
    const coverage = statsCoverageLines(copy, locale, player)
    return [
        {
            kind: "text",
            markdown: `${copy.kills} **${whole(m.kills.value)}** · ${copy.kd} **${n(player.kd)}** · ${copy.wins} **${whole(player.wins)} / ${whole(player.matches)}**`,
        },
        ...(detail.length || coverage.length
            ? [
                  {
                      kind: "text" as const,
                      markdown: [
                          ...(detail.length ? [detail.join(" · ")] : []),
                          ...coverage.map((line) => `-# ${line}`),
                      ].join("\n"),
                  },
              ]
            : []),
    ]
}

const RESULT_TONES: Record<"win" | "loss" | "draw" | "unknown", ChipTone> = {
    win: "success",
    loss: "danger",
    draw: "neutral",
    unknown: "neutral",
}

/** "🟢 **Výhra** ◈ **Valkyra** Zestafona · so 3. 10. · 18 zabití, 11 úmrtí". */
function wardogsRecent(
    input: StatsViewInput,
    stats: WardogsPlayerStats
): MessageBlock[] {
    const { copy, locale } = input
    const n = statsNumber(locale, 0)
    if (!stats.recent.length) return [{ kind: "text", markdown: copy.noItems }]
    return [
        {
            kind: "list",
            items: stats.recent.map((game) => {
                const result = game.result ?? "unknown"
                const faction = game.faction?.trim()
                const emblem = factionEmblem(faction, input.factionEmoji)
                return [
                    chipText({
                        label: copy.results[result],
                        tone: RESULT_TONES[result],
                    }),
                    ...(faction
                        ? [
                              `${emblem ? `${emblem} ` : ""}**${safe(faction, 40)}**`,
                          ]
                        : []),
                    fillTemplate(copy.recentRow, {
                        map: safe(game.map ?? "—", 60),
                        day:
                            shortDay(game.endedAt, locale, input.timeZone) ??
                            "—",
                        kills: n(game.metrics.kills ?? null),
                        deaths: n(game.metrics.deaths ?? null),
                    }),
                ].join(" ")
            }),
        },
    ]
}

/** "◈ **Valkyra** 8 z 12 výher · 214 zabití" (M2-18). */
function wardogsFactions(
    input: StatsViewInput,
    stats: WardogsPlayerStats
): MessageBlock[] {
    const { copy, locale } = input
    const n = statsNumber(locale, 0)
    if (!stats.factions.length)
        return [{ kind: "text", markdown: copy.noItems }]
    return [
        {
            kind: "list",
            items: stats.factions.map((faction) => {
                const emblem = factionEmblem(faction.name, input.factionEmoji)
                return `${emblem ? `${emblem} ` : ""}**${safe(faction.name, 40)}** ${fillTemplate(
                    copy.factionRow,
                    {
                        wins: n(faction.wins),
                        matches: n(faction.matches),
                        from: czechFrom(faction.matches),
                        kills: n(faction.kills),
                    }
                )}`
            }),
        },
    ]
}

/** The HLL overview (M2-19, M2-20). */
function hllOverview(
    input: StatsViewInput,
    profile: HllProfile
): MessageBlock[] {
    const { copy, locale } = input
    const n = statsNumber(locale)
    const whole = statsNumber(locale, 0)
    const plus = (value: number | null) =>
        profile.lowerBound && value !== null ? "+" : ""
    const lines = [
        fillTemplate(copy.hllDetail, {
            hours: `${whole(profile.hours)}${plus(profile.hours)}`,
            elo: whole(profile.elo),
            tk: whole(profile.teamKills),
        }),
        ...(profile.formWinRate === null
            ? []
            : [
                  fillTemplate(copy.form, {
                      rate: whole(profile.formWinRate),
                  }),
              ]),
    ]
    return [
        {
            kind: "text",
            markdown: `${copy.kills} **${whole(profile.kills)}** · ${copy.kd} **${n(profile.kd)}** · ${copy.matches} **${whole(profile.matches)}${plus(profile.matches)}**`,
        },
        { kind: "text", markdown: lines.join("\n") },
    ]
}

function hllList(
    input: StatsViewInput,
    profile: HllProfile,
    view: "recent" | "weapons" | "maps"
): MessageBlock[] {
    const items =
        view === "recent"
            ? profile.recent
                  .filter((game) => /^https:\/\//.test(game.url))
                  .map((game) => `[${safe(game.label, 120)}](${game.url})`)
            : profile[view].map((value) => safe(value, 120))
    return items.length
        ? [{ kind: "list", items, marker: "bullet" }]
        : [{ kind: "text", markdown: input.copy.noItems }]
}

/**
 * When the shown statistics were collected (M2-23, M2-B03): the Warcon
 * history's last collection or the HLL Records read. The shared card's "stav
 * k" uses it, so it equals the private card's "data z", not the share time.
 * Null when the source gave no time.
 */
export function statsDataTime(result: StatsResultData): string | null {
    return result.kind === "wardogs"
        ? result.fetchedAt
        : result.kind === "hll"
          ? result.read.fetchedAt
          : null
}

/** Whether the read holds statistics that can be shown and shared. */
export function statsPublishable(result: StatsResultData) {
    return result.kind === "wardogs"
        ? Boolean(result.stats)
        : result.kind === "hll"
          ? Boolean(result.read.profile) &&
            (result.read.status === "ok" || result.read.status === "stale")
          : false
}

/** The navigation and action buttons (M2-15, M2-21): one primary, the selected view. */
function statsButtons(input: StatsViewInput): MessageButton[][] {
    const { copy, controls } = input
    if (!controls) return []
    const views: Array<[StatsView, string]> =
        input.game === "hll"
            ? [
                  ["overview", copy.overview],
                  ["recent", copy.recent],
                  ["weapons", copy.weapons],
                  ["maps", copy.maps],
              ]
            : [
                  ["overview", copy.overview],
                  ["recent", copy.recent],
                  ["factions", copy.factions],
              ]
    const first: MessageButton[] = views.map(([view, label]) => ({
        kind: "action",
        id: controls.id(view),
        label,
        style: view === input.view ? "primary" : "secondary",
    }))
    if (controls.share)
        first.push({
            kind: "action",
            id: controls.id("share"),
            label: copy.share,
            style: "secondary",
        })
    const rows = [first]
    if (input.game === "hll" && input.hllProfileUrl)
        rows.push([
            { kind: "link", url: input.hllProfileUrl, label: copy.hllProfile },
        ])
    return rows
}

function sourceFooter(
    input: StatsViewInput,
    matches: number | null
): MessageView["footer"] {
    const { copy, locale } = input
    if (input.shared)
        return {
            kind: "managed",
            notes: [input.game === "hll" ? copy.sharedHll : copy.sharedWarcon],
        }
    if (input.game === "hll")
        return { kind: "managed", notes: [copy.sourceHll], managed: false }
    const fetchedAt =
        input.result.kind === "wardogs" ? input.result.fetchedAt : null
    const time = discordTimestamp(fetchedAt, "t")
    return {
        kind: "managed",
        managed: false,
        notes: [
            [
                copy.sourceWarcon,
                ...(matches === null
                    ? []
                    : [
                          fillTemplate(copy.sourceGames, {
                              games: formatCount(
                                  locale,
                                  matches,
                                  copy.gamesCount
                              ),
                          }),
                      ]),
                ...(time ? [fillTemplate(copy.dataAt, { time })] : []),
            ].join(" · "),
        ],
    }
}

function sharedLine(input: StatsViewInput): MessageBlock[] {
    const user = input.shared ? userMention(input.shared.userId) : undefined
    if (!input.shared || !user) return []
    return [
        { kind: "separator", divider: true, spacing: "small" },
        {
            kind: "text",
            markdown: `-# ${fillTemplate(input.copy.sharedBy, {
                user,
                time:
                    discordWeekdayTimestamp(
                        input.shared.at,
                        input.locale,
                        input.timeZone ?? "UTC"
                    ) ?? "",
            })}`,
        },
    ]
}

/**
 * The `/stats` card for a read (M2-12..29): the label "WARDOGS · POSLEDNÍCH
 * 30 DNÍ", the player, three numbers side by side, the selected view as the
 * one primary button, "Sdílet" grey and the source below. A missing Steam
 * asks to add it; an empty period suggests a longer one. Errors from the
 * source come back as {@link statsErrorCard}s.
 */
export function buildStatsView(input: StatsViewInput): MessageView {
    const { copy, result } = input
    const label = statsLabel(copy, input.game, input.period)
    const name = statsPlayerName(result, copy.otherFallbackName)

    if (result.kind === "missing_link" || result.kind === "ambiguous_link") {
        if (!input.self)
            return errorCard(
                result.kind === "missing_link"
                    ? {
                          title: fillTemplate(copy.otherMissingTitle, { name }),
                          body: copy.otherMissingBody,
                      }
                    : {
                          title: fillTemplate(copy.otherAmbiguousTitle, {
                              name,
                          }),
                          body: copy.otherAmbiguousBody,
                      }
            )
        const missing = result.kind === "missing_link"
        return {
            accent: "clan",
            ephemeral: true,
            header: {
                label,
                title: missing ? copy.missingTitle : copy.ambiguousTitle,
            },
            blocks: [
                {
                    kind: "text",
                    markdown: missing ? copy.missingBody : copy.ambiguousBody,
                },
                { kind: "text", markdown: `-# ${copy.declared}` },
                ...(input.controls
                    ? [
                          {
                              kind: "separator" as const,
                              divider: true,
                              spacing: "small" as const,
                          },
                          {
                              kind: "buttons" as const,
                              buttons: [
                                  {
                                      kind: "action" as const,
                                      id: input.controls.id("link"),
                                      label: missing
                                          ? copy.addSteam
                                          : copy.chooseSteam,
                                      style: "primary" as const,
                                  },
                              ],
                          },
                      ]
                    : []),
            ],
        }
    }

    if (result.kind === "hll") {
        const profile = result.read.profile
        if (result.read.status === "unavailable" || !profile) {
            if (result.read.status === "empty")
                return emptyView(input, label, name)
            return statsErrorCard(
                copy,
                result.read.reason === "blocked"
                    ? "blocked"
                    : "unavailable_hll",
                { hllProfileUrl: input.hllProfileUrl }
            )
        }
        if (result.read.status === "empty") return emptyView(input, label, name)
        const title =
            input.view === "overview"
                ? name
                : fillTemplate(
                      input.view === "recent"
                          ? copy.recentTitle
                          : input.view === "maps"
                            ? copy.mapsTitle
                            : copy.weaponsTitle,
                      { name }
                  )
        const content =
            input.view === "overview" || input.view === "factions"
                ? hllOverview(input, profile)
                : hllList(input, profile, input.view)
        return {
            accent: "clan",
            ephemeral: !input.shared,
            header: { label, title },
            blocks: [
                ...content,
                ...(result.read.status === "stale"
                    ? [{ kind: "text" as const, markdown: `-# ${copy.stale}` }]
                    : []),
                ...sharedLine(input),
                ...(input.shared
                    ? []
                    : [
                          {
                              kind: "separator" as const,
                              divider: true,
                              spacing: "small" as const,
                          },
                          ...statsButtons(input).map((buttons) => ({
                              kind: "buttons" as const,
                              buttons,
                          })),
                      ]),
            ],
            footer: sourceFooter(input, null),
        }
    }

    const stats = result.stats
    if (!stats) return emptyView(input, label, name)
    const title =
        input.view === "recent"
            ? fillTemplate(copy.recentTitle, { name })
            : input.view === "factions"
              ? fillTemplate(copy.factionsTitle, { name })
              : name
    const content =
        input.view === "recent"
            ? wardogsRecent(input, stats)
            : input.view === "factions"
              ? wardogsFactions(input, stats)
              : wardogsOverview(input, stats)
    return {
        accent: "clan",
        ephemeral: !input.shared,
        header: { label, title },
        blocks: [
            ...content,
            ...sharedLine(input),
            ...(input.shared
                ? []
                : [
                      {
                          kind: "separator" as const,
                          divider: true,
                          spacing: "small" as const,
                      },
                      ...statsButtons(input).map((buttons) => ({
                          kind: "buttons" as const,
                          buttons,
                      })),
                  ]),
        ],
        footer: sourceFooter(input, stats.player.matches),
    }
}

const LONGER: Record<StatsPeriod, StatsPeriod | null> = {
    "7d": "30d",
    "30d": "90d",
    "90d": "all",
    all: null,
}

/** "Za posledních 7 dní nemáš na serverech klanu žádnou hru." (M2-29). */
function emptyView(
    input: StatsViewInput,
    label: string,
    name: string
): MessageView {
    const { copy } = input
    const period = copy.periodPhrases[input.period]
    const next = LONGER[input.period]
    const body =
        input.game === "hll"
            ? fillTemplate(copy.emptyHll, { period })
            : fillTemplate(input.self ? copy.emptySelf : copy.emptyOther, {
                  period,
              })
    const lines = [
        body,
        ...(next
            ? [
                  `-# ${fillTemplate(copy.emptyNext, {
                      game: copy.games[input.game],
                      next: copy.periodChoices[next],
                  })}`,
              ]
            : []),
    ]
    return {
        accent: "clan",
        ephemeral: true,
        header: { label, title: name },
        blocks: [{ kind: "text", markdown: lines.join("\n") }],
        footer: sourceFooter(input, null),
    }
}

export type StatsErrorKey =
    | "unavailable_warcon"
    | "unavailable_hll"
    | "blocked"
    | "game_disabled"
    | "invalid"
    | "hll_only"
    | "busy"
    | "expired"
    | "own_only"
    | "forbidden"
    | "incomplete"
    | "not_configured"
    | "link_changed"
    | "already_linked"
    | "invalid_steam"
    | "link_error"

/**
 * The private error cards of `/stats` (M2-30..33, M3-05): the reason as the
 * title, the next step, at most one button.
 */
export function statsErrorCard(
    copy: StatsCopy,
    key: StatsErrorKey,
    extra: {
        gameLabel?: string
        hllProfileUrl?: string
        retryId?: string
    } = {}
): MessageView {
    const e = copy.errors
    switch (key) {
        case "unavailable_warcon":
            return errorCard({
                title: e.unavailableTitle,
                body: e.unavailableWarcon,
            })
        case "unavailable_hll":
            return errorCard({
                title: e.unavailableTitle,
                body: e.unavailableHll,
            })
        case "blocked":
            return errorCard({
                title: e.blockedTitle,
                body: e.blockedBody,
                action: extra.hllProfileUrl
                    ? {
                          kind: "link",
                          url: extra.hllProfileUrl,
                          label: copy.hllProfile,
                      }
                    : undefined,
            })
        case "game_disabled":
            return errorCard({
                title: fillTemplate(e.gameDisabledTitle, {
                    game: extra.gameLabel ?? "",
                }),
                body: e.gameDisabledBody,
            })
        case "invalid":
            return errorCard({ title: e.invalidTitle, body: e.invalidBody })
        case "hll_only":
            return errorCard({ title: e.hllOnlyTitle, body: e.hllOnlyBody })
        case "busy":
            return errorCard({ title: e.busyTitle, body: e.busyBody })
        case "expired":
            return errorCard({ title: e.expiredTitle, body: e.expiredBody })
        case "own_only":
            return errorCard({ title: e.ownOnlyTitle, body: e.ownOnlyBody })
        case "forbidden":
            return errorCard({ title: e.forbiddenTitle, body: e.forbiddenBody })
        case "incomplete":
            return errorCard({
                title: e.incompleteTitle,
                body: e.incompleteBody,
            })
        case "not_configured":
            return errorCard({
                title: e.notConfiguredTitle,
                body: e.notConfiguredBody,
            })
        case "link_changed":
            return errorCard({
                title: e.linkChangedTitle,
                body: e.linkChangedBody,
            })
        case "already_linked":
            return errorCard({
                title: e.alreadyLinkedTitle,
                body: e.alreadyLinkedBody,
            })
        case "invalid_steam":
            return errorCard({
                title: e.invalidSteamTitle,
                body: e.invalidSteamBody,
                action: extra.retryId
                    ? {
                          kind: "action",
                          id: extra.retryId,
                          label: copy.retry,
                          style: "primary",
                      }
                    : undefined,
            })
        case "link_error":
            return errorCard({ title: e.linkErrorTitle, body: e.linkErrorBody })
    }
}

/** "Kam kartu poslat?" with "Zpět"; the bot adds the channel select (M2-24). */
export function statsSharePromptView(
    copy: StatsCopy,
    backId: string
): MessageView {
    return {
        accent: "clan",
        ephemeral: true,
        header: { title: copy.shareFlow.promptTitle },
        blocks: [
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: backId,
                        label: copy.shareFlow.back,
                        style: "secondary",
                    },
                ],
            },
        ],
    }
}
