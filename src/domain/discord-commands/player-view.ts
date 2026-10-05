import {
    errorCard,
    escapeMarkdownText,
    type MessageBlock,
    type MessageChip,
    type MessageView,
} from "../discord-messages/message-view"
import {
    discordWeekdayTimestamp,
    fillTemplate,
    formatCount,
    type PluralForms,
} from "../discord-messages/format"
import {
    clanDecimal,
    clanNumber,
    dayMonth,
    shortDay,
    userMention,
} from "./text"

/** The `/player` copy of the commands module (`clan-language/commands.ts`). */
export type PlayerCopy = {
    label: string
    statuses: {
        member: string
        reserve_member: string
        mercenary: string
        recruit: string
        pending: string
        active: string
        paused: string
    }
    score: string
    matches: string
    kd: string
    averages: string
    recentTitle: string
    recentRow: string
    share: string
    source: string
    sourceSince: string
    matchCount: PluralForms
    sharedBy: string
    sharedSource: string
    noMatches: string
    notFoundTitle: string
    notFoundBody: string
    loadFailedTitle: string
    loadFailedBody: string
    sharedTitle: string
    viewMessage: string
    shareDeniedTitle: string
    shareDeniedBody: string
    shareFailedTitle: string
    shareFailedBody: string
    avatar: string
}

export type PlayerAssignment = {
    type?: "member" | "reserve_member" | "mercenary"
    status?: "pending" | "recruit" | "active"
    paused?: boolean
}

/** What the profile shows; read from the clan's imported matches. */
export type PlayerProfileData = {
    name: string
    avatar?: string | null
    assignment: PlayerAssignment
    score: number
    matchesPlayed: number
    averages: {
        kills: number
        deaths: number
        killDeathRatio: number
        offense: number
        defense: number
        support: number
    }
    recentMatches: ReadonlyArray<{
        mapName?: string | null
        mapId: string
        endedAt?: string | null
        importedAt: string
        kills: number
        deaths: number
        killDeathRatio: number
    }>
    /** The oldest imported match, for "48 zápasů od 2. 6.". */
    firstMatchAt?: string | null
}

/** The clan profile as `players:getClanPlayerProfile` returns it. */
export type ClanPlayerProfileRow = {
    name: string
    avatar?: string | null
    assignment: PlayerAssignment
    score?: number | null
    performance?: {
        matchesPlayed?: number | null
        averages?: Partial<PlayerProfileData["averages"]> | null
    } | null
    recentMatches?: PlayerProfileData["recentMatches"] | null
    firstMatchAt?: string | null
}

/** The profile the card shows, from the stored clan profile. */
export function playerProfileFromRow(
    row: ClanPlayerProfileRow
): PlayerProfileData {
    const averages = row.performance?.averages ?? {}
    const number = (value: number | null | undefined) =>
        typeof value === "number" && Number.isFinite(value) ? value : 0
    return {
        name: row.name,
        avatar: row.avatar,
        assignment: row.assignment,
        score: number(row.score),
        matchesPlayed: number(row.performance?.matchesPlayed),
        averages: {
            kills: number(averages.kills),
            deaths: number(averages.deaths),
            killDeathRatio: number(averages.killDeathRatio),
            offense: number(averages.offense),
            defense: number(averages.defense),
            support: number(averages.support),
        },
        recentMatches: row.recentMatches ?? [],
        firstMatchAt: row.firstMatchAt ?? null,
    }
}

/** "Člen · aktivní", "Rekrut", "Člen · pozastavený" (M2-35, M2-36). */
export function playerStatusLabel(
    copy: PlayerCopy,
    assignment: PlayerAssignment
) {
    if (assignment.status === "pending") return copy.statuses.pending
    if (assignment.status === "recruit") return copy.statuses.recruit
    const type = copy.statuses[assignment.type ?? "member"]
    return `${type} · ${assignment.paused ? copy.statuses.paused : copy.statuses.active}`
}

export function playerStatusChip(
    copy: PlayerCopy,
    assignment: PlayerAssignment
): MessageChip {
    return {
        label: playerStatusLabel(copy, assignment),
        tone:
            assignment.status === "pending"
                ? "info"
                : assignment.status === "recruit"
                  ? "warning"
                  : assignment.paused
                    ? "neutral"
                    : "success",
    }
}

/** The autocomplete row "Hráč 17 · Člen · aktivní" (plain text, ≤ 100). */
export function playerOptionLabel(
    copy: PlayerCopy,
    player: { name: string } & PlayerAssignment
) {
    const name = player.name.replace(/\s+/g, " ").trim() || "?"
    return `${name} · ${playerStatusLabel(copy, player)}`.slice(0, 100)
}

export type PlayerViewInput = {
    copy: PlayerCopy
    /** The game the imported matches come from, e.g. "Hell Let Loose". */
    gameLabel: string
    profile: PlayerProfileData
    locale: string
    timeZone?: string
    /** The private reply's "Sdílet" button; omitted when sharing is off. */
    shareId?: string
    /** The shared post: who shared it and when the data was read. */
    shared?: { userId: string; at: string | number }
}

/**
 * The `/player` card (M2-36..43): game and "Profil hráče" on top, the name,
 * a small avatar on the right and the status chip, three numbers, the
 * per-match averages and the last matches; "Sdílet" and the source below.
 * Without matches it says so and has nothing to share.
 */
export function buildPlayerProfileView(input: PlayerViewInput): MessageView {
    const { copy, profile, locale } = input
    const n = clanNumber(locale, 0)
    const decimal = clanDecimal(locale)
    const twoDecimals = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
    const kd = (value: number) =>
        Number.isFinite(value) ? twoDecimals.format(value) : "—"
    const hasMatches =
        profile.matchesPlayed > 0 || profile.recentMatches.length > 0
    const blocks: MessageBlock[] = []
    if (hasMatches) {
        blocks.push({
            kind: "text",
            markdown: [
                `${copy.score} **${n(profile.score)}** · ${copy.matches} **${n(profile.matchesPlayed)}** · ${copy.kd} **${kd(profile.averages.killDeathRatio)}**`,
                fillTemplate(copy.averages, {
                    kills: decimal(profile.averages.kills),
                    deaths: decimal(profile.averages.deaths),
                    offense: n(profile.averages.offense),
                    defense: n(profile.averages.defense),
                    support: n(profile.averages.support),
                }),
            ].join("\n"),
        })
        const rows = profile.recentMatches.map((match) =>
            fillTemplate(copy.recentRow, {
                day:
                    shortDay(
                        match.endedAt ?? match.importedAt,
                        locale,
                        input.timeZone
                    ) ?? "—",
                map: escapeMarkdownText(
                    (match.mapName?.trim() || match.mapId).slice(0, 60)
                ),
                kills: n(match.kills),
                deaths: n(match.deaths),
                kd: kd(match.killDeathRatio),
            })
        )
        if (rows.length)
            blocks.push({
                kind: "text",
                markdown: [
                    `**${copy.recentTitle.toLocaleUpperCase(locale)}**`,
                    ...rows,
                ].join("\n"),
            })
    } else {
        blocks.push({ kind: "text", markdown: copy.noMatches })
    }

    const sharedBy = input.shared ? userMention(input.shared.userId) : null
    if (input.shared && sharedBy) {
        blocks.push({ kind: "separator", divider: true, spacing: "small" })
        blocks.push({
            kind: "text",
            markdown: `-# ${fillTemplate(copy.sharedBy, {
                user: sharedBy,
                time:
                    discordWeekdayTimestamp(
                        input.shared.at,
                        locale,
                        input.timeZone ?? "UTC"
                    ) ?? "",
            })}`,
        })
    } else {
        blocks.push({ kind: "separator", divider: true, spacing: "small" })
        if (input.shareId && hasMatches)
            blocks.push({
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: input.shareId,
                        label: copy.share,
                        style: "primary",
                    },
                ],
            })
    }

    const since =
        hasMatches && profile.firstMatchAt
            ? dayMonth(profile.firstMatchAt, locale, input.timeZone)
            : undefined
    const source = since
        ? `${copy.source} · ${fillTemplate(copy.sourceSince, {
              count: formatCount(
                  locale,
                  profile.matchesPlayed,
                  copy.matchCount
              ),
              date: since,
          })}`
        : copy.source
    const avatar = profile.avatar?.trim()
    return {
        accent: "clan",
        ephemeral: !input.shared,
        header: {
            label: fillTemplate(copy.label, { game: input.gameLabel }),
            title: profile.name.trim() || "?",
            chips: [playerStatusChip(copy, profile.assignment)],
            ...(avatar && /^https:\/\//.test(avatar)
                ? {
                      thumbnail: {
                          url: avatar,
                          description: fillTemplate(copy.avatar, {
                              name: profile.name,
                          }).slice(0, 1024),
                      },
                  }
                : {}),
        },
        blocks,
        footer: input.shared
            ? { kind: "managed", notes: [copy.sharedSource] }
            : { kind: "managed", notes: [source], managed: false },
    }
}

export function playerNotFoundCard(copy: PlayerCopy): MessageView {
    return errorCard({ title: copy.notFoundTitle, body: copy.notFoundBody })
}

export function playerLoadFailedCard(copy: PlayerCopy): MessageView {
    return errorCard({
        title: copy.loadFailedTitle,
        body: copy.loadFailedBody,
    })
}
