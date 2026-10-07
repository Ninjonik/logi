import type { MatchAnnouncementCopy } from "@/domain/discord-messages/match-announcement-copy"
import { panelFactionOf } from "@/domain/discord-publications/panel-presentation"
import { fillTemplate } from "@/domain/discord-messages/format"
import { clanClock } from "@/domain/events/calendar-link"

/** Discord's limits for a scheduled event. */
const NAME_LIMIT = 100
const DESCRIPTION_LIMIT = 1000

export type ScheduledEventContentInput = {
    kind: "match" | "training"
    /** "VLK vs ROG · Přátelák". */
    title: string
    /** The category label; "Zápas" stands in when there is none. */
    category?: string | null
    /** The other team's short code. */
    opponent?: string | null
    /** The clan's side as stored ("Allies", "Valkyra"). */
    side?: string | null
    /** Plain map label, "Foy · den". */
    mapLabel?: string | null
    /** A training's server name (a training has no roster to hide it in). */
    server?: string | null
    /** The match has a server password (it is never written here). */
    hasPassword: boolean
    meetingStart: string
    gameStart: string
    /** Where the announcement is: "Přihláška a soupiska: #oznameni". */
    announcementChannelId?: string | null
    locale: string
    timeZone: string
    copy: MatchAnnouncementCopy
}

/** "hrajeme za Spojence": the side in the case the sentence needs. */
function sideAs(side: string, copy: MatchAnnouncementCopy) {
    const faction = panelFactionOf(side)
    return faction === "allies" || faction === "axis"
        ? copy.scheduledEvent.sidesAs[faction]
        : side.trim()
}

/**
 * The Discord scheduled event of a match in the clan language (board L1
 * 1.14, L1-138, L1-139): name "VLK vs ROG · Přátelák" and the description
 * "Přátelák proti ROG, hrajeme za Spojence." / "Sraz 19:30, start 20:00 · Foy
 * · den" / "Přihláška a soupiska: #oznameni" / the password hint. Every
 * guild member can read it, so the password itself never appears (L1-B07).
 */
export function buildScheduledEventContent(input: ScheduledEventContentInput) {
    const { copy } = input
    const text = copy.scheduledEvent
    const lines: string[] = []
    if (input.kind === "match") {
        const category = input.category?.trim() || text.match
        const opponent = input.opponent?.trim()
        const side = input.side?.trim()
        lines.push(
            opponent && side
                ? fillTemplate(text.againstAs, {
                      category,
                      opponent,
                      side: sideAs(side, copy),
                  })
                : opponent
                  ? fillTemplate(text.against, { category, opponent })
                  : side
                    ? fillTemplate(text.as, {
                          category,
                          side: sideAs(side, copy),
                      })
                    : `${category}.`
        )
    }
    const meeting = clanClock(input.meetingStart, input.locale, input.timeZone)
    const start = clanClock(input.gameStart, input.locale, input.timeZone)
    if (meeting && start)
        lines.push(
            [
                fillTemplate(text.times, { meeting, start }),
                input.kind === "match" ? input.mapLabel?.trim() : undefined,
            ]
                .filter(Boolean)
                .join(" · ")
        )
    if (input.announcementChannelId)
        lines.push(
            fillTemplate(
                input.kind === "match" ? text.signup : text.trainingSignup,
                { channel: `<#${input.announcementChannelId}>` }
            )
        )
    if (input.kind === "training" && input.server?.trim())
        lines.push(fillTemplate(text.server, { server: input.server.trim() }))
    if (input.kind === "match" && input.hasPassword) lines.push(text.password)
    return {
        name: input.title.slice(0, NAME_LIMIT),
        description: lines.join("\n").slice(0, DESCRIPTION_LIMIT),
    }
}

export function resolveScheduledEventEndTime(input: {
    meetingStart: string
    gameEnd: string
}) {
    const scheduledStartTime = new Date(input.meetingStart)
    const scheduledEndTime = new Date(input.gameEnd)

    if (
        Number.isFinite(scheduledStartTime.getTime()) &&
        Number.isFinite(scheduledEndTime.getTime()) &&
        scheduledEndTime.getTime() > scheduledStartTime.getTime()
    ) {
        return scheduledEndTime
    }

    return new Date(scheduledStartTime.getTime() + 90 * 60 * 1000)
}
