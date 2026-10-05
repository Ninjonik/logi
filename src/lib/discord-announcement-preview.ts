import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import { getClanDiscordMessages } from "@/lib/clan-language"
import type { GameId } from "@/domain/games/game"

/** What the create form knows about the event the bot will announce. */
export type AnnouncementPreviewInput = {
    kind: "match" | "training"
    name: string
    /** The clan's bot language. */
    language?: string
    gameId?: GameId
    registrationEnd?: string
    meetingStart?: string
    gameStart?: string
    map?: string
    side?: string
    cap?: string
    server?: string
    serverPassword?: string
    description?: string
    notes?: string
    category?: { label: string; color: string } | null
    /** Signup groups shown as buttons, in clan order. */
    signupGroups: Array<{ name: string; emoji?: string }>
    /** Names of the roles the announcement pings. */
    mentions: string[]
    thumbnailUrl?: string
    imageUrl?: string
}

export type PreviewValue =
    | { kind: "text"; text: string }
    | { kind: "code"; text: string }
    /** A Discord timestamp, rendered in the reader's time zone. */
    | { kind: "time"; iso: string; style: "F" | "f" | "t" | "R" }

export type PreviewLine = {
    emoji: string
    label: string
    values: PreviewValue[]
}

export type AnnouncementPreview = {
    accentColor: string
    mentions: string[]
    title: string
    /** Text blocks separated by a divider, in the bot's order. */
    blocks: PreviewLine[][]
    signupSections: Array<{ title: string; text: string }>
    imageUrl?: string
    thumbnailUrl?: string
    buttons: Array<{
        label: string
        emoji?: string
        style: "success" | "primary" | "danger" | "link"
    }>
}

const DEFAULT_ACCENT = "#FFB000"

const text = (value: string): PreviewValue => ({ kind: "text", text: value })
const time = (iso: string, style: "F" | "f" | "t" | "R"): PreviewValue => ({
    kind: "time",
    iso,
    style,
})

/**
 * The registration announcement as the bot posts it for a new event with open
 * sign-ups (`buildAnnouncementV2Message`): the same lines, order, labels in the
 * clan's bot language and buttons. Values the web cannot know before the
 * event exists, such as sign-ups and the forum link, are left out.
 */
export function buildAnnouncementPreview(
    input: AnnouncementPreviewInput,
    untitled: string
): AnnouncementPreview {
    const messages = getClanDiscordMessages(input.language)
    const lines: Array<PreviewLine | "divider"> = []
    const isMatch = input.kind === "match"

    if (isMatch) {
        if (input.meetingStart)
            lines.push({
                emoji: "👥",
                label: messages.embed.headcountStart,
                values: [time(input.meetingStart, "F")],
            })
        if (input.gameStart)
            lines.push({
                emoji: "🎮",
                label: messages.embed.matchStart,
                values: [time(input.gameStart, "F")],
            })
        if (input.registrationEnd)
            lines.push({
                emoji: "🔒",
                label: messages.embed.registrationEnds,
                values: [time(input.registrationEnd, "F")],
            })
        lines.push("divider")
    }
    if (isMatch && input.map)
        lines.push({
            emoji: "🗺️",
            label: messages.embed.map,
            values: [
                text(
                    formatHllPresetLabel(input.map, input.gameId) ?? input.map
                ),
            ],
        })
    if (isMatch && input.side)
        lines.push({
            emoji: "⚔️",
            label: messages.embed.side,
            values: [text(input.side)],
        })
    if (isMatch && input.cap)
        lines.push({
            emoji: "🎯",
            label: messages.embed.cap,
            values: [text(input.cap)],
        })
    if (input.server)
        lines.push({
            emoji: "🖥️",
            label: messages.embed.server,
            values: [text(input.server)],
        })
    if (isMatch && input.serverPassword)
        lines.push({
            emoji: "🔑",
            label: messages.embed.password,
            values: [{ kind: "code", text: input.serverPassword }],
        })
    const description = input.notes?.trim() || input.description?.trim()
    if (description)
        lines.push({
            emoji: "📝",
            label: messages.embed.description,
            values: [text(description)],
        })
    if (lines.length) lines.push("divider")
    if (!isMatch) {
        if (input.registrationEnd)
            lines.push({
                emoji: "🔒",
                label: messages.embed.registrationEnds,
                values: [
                    time(input.registrationEnd, "R"),
                    time(input.registrationEnd, "f"),
                ],
            })
        if (input.meetingStart) {
            lines.push({
                emoji: "👥",
                label: messages.embed.meeting,
                values: [time(input.meetingStart, "t")],
            })
            lines.push({
                emoji: "🎯",
                label: messages.embed.trainingStart,
                values: [time(input.meetingStart, "F")],
            })
        }
    }
    if (input.category?.label)
        lines.push({
            emoji: "🏷️",
            label: messages.calendar.matchLabel,
            values: [text(input.category.label)],
        })
    lines.push({
        emoji: "📌",
        label: messages.embed.status,
        values: [text(messages.statuses.registration)],
    })
    lines.push({
        emoji: "👥",
        label: messages.embed.signupCount,
        values: [text("0")],
    })

    const blocks: PreviewLine[][] = [[]]
    for (const line of lines) {
        if (line === "divider") blocks.push([])
        else blocks[blocks.length - 1].push(line)
    }

    const signupSections = isMatch
        ? [
              ...input.signupGroups.map((group) => ({
                  title: `${group.emoji || "👥"} ${group.name} (0)`,
                  text: messages.embed.nobodyYet,
              })),
              {
                  title: `❌ ${messages.embed.notAttending} (0)`,
                  text: messages.embed.nobodyYet,
              },
          ]
        : [
              {
                  title: `✅ ${messages.embed.attending} (0)`,
                  text: messages.embed.nobodyYet,
              },
              {
                  title: `❌ ${messages.embed.notAttending} (0)`,
                  text: messages.embed.nobodyYet,
              },
          ]

    return {
        accentColor: input.category?.color || DEFAULT_ACCENT,
        mentions: input.mentions,
        title: input.name.trim() || untitled,
        blocks: blocks.filter((block) => block.length),
        signupSections,
        imageUrl: isMatch ? input.imageUrl || undefined : undefined,
        thumbnailUrl: input.thumbnailUrl || undefined,
        buttons: [
            {
                label: isMatch
                    ? messages.embed.chooseSignup
                    : messages.buttons.attend,
                emoji: "✅",
                style: "success",
            },
            {
                label: messages.buttons.checkSignup,
                emoji: "🔎",
                style: "primary",
            },
            { label: messages.buttons.decline, emoji: "❌", style: "danger" },
            {
                label: messages.buttons.addToCalendar,
                emoji: isMatch ? undefined : "➕",
                style: "link",
            },
        ],
    }
}
