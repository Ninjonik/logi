/**
 * The match forum's posts (board L1 1.13) and the optional attendance post
 * in the match thread (board L5-43): "Informace o zápasu", a topic from the
 * preset, the pinned Debrief that gains the result once the leaders confirm
 * it, and "Hráč 17 přijde později" without the reason. Pure cards; the
 * copy, names and links come in.
 */

import {
    escapeMarkdownText,
    type ChipTone,
    type MessageBlock,
    type MessageChip,
    type MessageView,
} from "./message-view"
import {
    channelMention,
    matchSidesLine,
    type MatchTeamText,
    weekdayDate,
} from "./match-text"
import { discordTimestamp, fillTemplate } from "./format"
import { showAssignmentButton } from "./roster-message"
import type { RosterMessageCopy } from "./match-copy"

type Copy = RosterMessageCopy & { locale: string }

const oneLine = (value: string) => value.replace(/[\s\p{Cc}]+/gu, " ").trim()

const joinParts = (parts: Array<string | undefined>) =>
    parts.filter((part): part is string => Boolean(part)).join(" · ")

/**
 * The tone whose dot is closest to a category colour, so a category chip
 * keeps its colour as the dot (L1-07) within the chip vocabulary.
 */
export function categoryChipTone(color: string | null | undefined): ChipTone {
    const match = color?.trim().match(/^#?([0-9a-f]{6})$/i)
    if (!match) return "neutral"
    const value = Number.parseInt(match[1]!, 16)
    const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max - min < 40) return "neutral"
    let hue: number
    if (max === r) hue = ((g - b) / (max - min)) * 60
    else if (max === g) hue = ((b - r) / (max - min)) * 60 + 120
    else hue = ((r - g) / (max - min)) * 60 + 240
    hue = (hue + 360) % 360
    if (hue < 20 || hue >= 330) return "danger"
    if (hue < 70) return "warning"
    if (hue < 170) return "success"
    return "info"
}

/** The match category as a chip; none for trainings and uncategorised matches. */
export function categoryChip(
    category: { label: string; color?: string | null } | undefined
): MessageChip[] {
    const label = category?.label.trim()
    return label ? [{ label, tone: categoryChipTone(category?.color) }] : []
}

export type ForumEvent = {
    id: string
    /** "VLK vs ROG". */
    title: string
    category?: { label: string; color?: string | null }
    teams?: readonly MatchTeamText[]
    side?: string | null
    mapLabel?: string
    meetingStart: string
    gameStart: string
    meetingChannelId?: string
    server?: string
    hasPassword: boolean
    notes?: string
    description?: string
    imageUrl?: string
}

export type ForumContext = {
    copy: Copy
    timeZone: string
    /** Faction emblems (installed application emoji), if any. */
    emoji?: Parameters<typeof matchSidesLine>[0]["emoji"]
}

/** Notes as markdown: Discord markdown stays, mentions are broken. */
function notesMarkdown(value: string | undefined) {
    const text = value?.trim()
    return text
        ? text.replace(/<(@[!&]?|#)(\d{17,20})>/g, "<$1​$2>").slice(0, 1500)
        : undefined
}

/**
 * "Informace o zápasu", the forum's first post: the match with its category
 * chip, the sides, start and meeting, the server without the password,
 * notes, named tactical maps, the briefing image and "Zobrazit zařazení".
 */
export function forumInfoView(input: {
    event: ForumEvent
    stratmaps: ReadonlyArray<{ title?: string; url: string }>
    context: ForumContext
}): MessageView {
    const { event, context } = input
    const { copy } = context
    const date = weekdayDate(event.gameStart, copy.locale, context.timeZone)
    const time = discordTimestamp(event.gameStart, "t")
    const relative = discordTimestamp(event.gameStart, "R")
    const meetingTime = discordTimestamp(event.meetingStart, "t")
    const channel = channelMention(event.meetingChannelId)
    const meeting = meetingTime
        ? channel
            ? fillTemplate(copy.common.meetingInChannel, {
                  time: meetingTime,
                  channel,
              })
            : fillTemplate(copy.common.meeting, { time: meetingTime })
        : undefined
    const server = event.server?.trim()
    const serverLine = server
        ? fillTemplate(
              event.hasPassword
                  ? copy.forum.server
                  : copy.forum.serverNoPassword,
              { server: `**${escapeMarkdownText(oneLine(server))}**` }
          )
        : undefined
    const sides = matchSidesLine({
        teams: event.teams,
        side: event.side,
        factions: copy.factions,
        emoji: context.emoji,
    })
    const maps = input.stratmaps
        .filter((map) => /^https?:\/\//.test(map.url))
        .map(
            (map, index) =>
                `[${escapeMarkdownText(oneLine(map.title?.trim() || fillTemplate(copy.forum.stratmapFallback, { index: String(index + 1) })))}](${map.url})`
        )
    const notes = [event.description, event.notes]
        .map(notesMarkdown)
        .filter((text): text is string => Boolean(text))
    const blocks: MessageBlock[] = [
        ...(sides ? [{ kind: "text" as const, markdown: sides }] : []),
        ...(date && time
            ? [
                  {
                      kind: "text" as const,
                      markdown: joinParts([`**${date} · ${time}**`, relative]),
                  },
              ]
            : []),
        ...(joinParts([event.mapLabel, meeting])
            ? [
                  {
                      kind: "meta" as const,
                      lines: [{ text: joinParts([event.mapLabel, meeting]) }],
                  },
              ]
            : []),
        ...(serverLine
            ? [{ kind: "text" as const, markdown: serverLine }]
            : []),
        ...[...new Set(notes)].map((markdown) => ({
            kind: "text" as const,
            markdown,
        })),
        ...(maps.length
            ? [
                  {
                      kind: "text" as const,
                      markdown: [`**${copy.forum.stratmaps}**`, ...maps].join(
                          " · "
                      ),
                  },
              ]
            : []),
        ...(event.imageUrl && /^https?:\/\//.test(event.imageUrl)
            ? [
                  {
                      kind: "gallery" as const,
                      items: [
                          {
                              url: event.imageUrl,
                              description: copy.forum.briefingImage,
                          },
                      ],
                  },
              ]
            : []),
        { kind: "separator", divider: true, spacing: "small" },
        { kind: "buttons", buttons: [showAssignmentButton(event.id, copy)] },
    ]
    return {
        accent: "clan",
        header: {
            label: copy.forum.info,
            title: event.title,
            chips: categoryChip(event.category),
        },
        blocks,
        footer: { kind: "managed" },
    }
}

/**
 * A topic post from the preset: the topic as the title, its text, and the
 * footer naming the preset. Attachments are added by the bot as files.
 */
export function forumTopicView(input: {
    title: string
    body?: string
    presetName?: string
    copy: Copy
}): MessageView {
    const body = notesMarkdown(input.body)
    const preset = input.presetName?.trim()
    return {
        accent: "clan",
        header: { title: oneLine(input.title) },
        blocks: body ? [{ kind: "text", markdown: body }] : [],
        footer: {
            kind: "managed",
            notes: preset
                ? [
                      fillTemplate(input.copy.forum.topicFooter, {
                          preset: escapeMarkdownText(oneLine(preset)),
                      }),
                  ]
                : [],
        },
    }
}

export type DebriefResult = {
    outcome: "win" | "loss" | "draw"
    /** The clan's score first, "4 : 1". */
    score: string
    /** The public match page, when one exists. */
    matchUrl?: string
}

/**
 * The pinned Debrief: "Odehráno" with the date, the confirmed result and the
 * map, the prompt for notes and, once a match page exists, "Zobrazit zápas".
 */
export function debriefView(input: {
    event: Pick<ForumEvent, "title" | "category" | "gameStart" | "mapLabel">
    result?: DebriefResult | null
    context: ForumContext
}): MessageView {
    const { event, result, context } = input
    const { copy } = context
    const date = weekdayDate(event.gameStart, copy.locale, context.timeZone)
    const outcome = result
        ? `**${fillTemplate(copy.forum.outcome[result.outcome], {
              score: escapeMarkdownText(result.score),
          })}**`
        : undefined
    return {
        accent: "clan",
        header: {
            label: copy.forum.debrief,
            title: event.title,
            chips: [
                ...categoryChip(event.category),
                { label: copy.forum.played, tone: "neutral" },
            ],
            status: joinParts([date, outcome, event.mapLabel]),
        },
        blocks: [
            { kind: "text", markdown: copy.forum.debriefBody },
            ...(result?.matchUrl && /^https?:\/\//.test(result.matchUrl)
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
                                  kind: "link" as const,
                                  url: result.matchUrl,
                                  label: copy.forum.showMatch,
                              },
                          ],
                      },
                  ]
                : []),
        ],
        footer: { kind: "managed" },
    }
}

/**
 * The optional attendance post in the match thread: who is late or not
 * coming, with their place, never the reason (board L5-43, off by default).
 */
export function attendanceNoticeView(input: {
    kind: "late" | "absent"
    /** The player's plain name; the card escapes it. */
    name: string
    event: Pick<ForumEvent, "title" | "gameStart">
    place?: { squad: string; role?: string }
    attendanceUrl?: string
    context: ForumContext
}): MessageView {
    const { context, event } = input
    const { copy } = context
    const date = weekdayDate(event.gameStart, copy.locale, context.timeZone)
    const start = discordTimestamp(event.gameStart, "t")
    const meta = joinParts([
        date,
        start ? fillTemplate(copy.common.startAt, { time: start }) : undefined,
        input.place
            ? escapeMarkdownText(oneLine(input.place.squad))
            : undefined,
        input.place?.role
            ? escapeMarkdownText(oneLine(input.place.role))
            : undefined,
    ])
    return {
        accent: "clan",
        header: {
            label: fillTemplate(copy.notice.label, { match: event.title }),
            title: fillTemplate(
                input.kind === "late"
                    ? copy.notice.lateTitle
                    : copy.notice.absentTitle,
                { name: input.name }
            ),
        },
        blocks: [
            ...(meta
                ? [{ kind: "meta" as const, lines: [{ text: meta }] }]
                : []),
            { kind: "text", markdown: copy.notice.reasonHidden },
            ...(input.attendanceUrl && /^https?:\/\//.test(input.attendanceUrl)
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
                                  kind: "link" as const,
                                  url: input.attendanceUrl,
                                  label: copy.notice.attendanceLink,
                              },
                          ],
                      },
                  ]
                : []),
        ],
        footer: { kind: "managed" },
    }
}
