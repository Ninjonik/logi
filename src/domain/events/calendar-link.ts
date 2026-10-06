/**
 * "Přidat do kalendáře" on the match announcement (board L1 1.14, L1-142,
 * L1-B18): a prefilled Google Calendar event from the meeting to the match
 * end, with a readable place and a link back to the announcement. Never the
 * server password (L1-03).
 */

import type { MatchAnnouncementCopy } from "../discord-messages/match-announcement-copy"
import { fillTemplate } from "../discord-messages/format"

/** Discord rejects link buttons with longer URLs. */
const MAX_URL = 512
const FALLBACK_LENGTH_MS = 90 * 60 * 1000

const basic = (ms: number) =>
    `${new Date(ms).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`

/** "20:00" in the clan's time zone, for plain text outside Discord. */
export function clanClock(iso: string, locale: string, timeZone: string) {
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) return undefined
    const format = (zone: string) =>
        new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            timeZone: zone,
        }).format(ms)
    try {
        return format(timeZone)
    } catch {
        return format("UTC")
    }
}

/** The calendar text of a markdown-escaped label ("Foy · den"). */
export function plainText(markdown: string) {
    return markdown
        .replace(/\\(.)/g, "$1")
        .replace(/[\s\p{Cc}]+/gu, " ")
        .trim()
}

export type CalendarLinkInput = {
    kind: "match" | "training"
    /** "VLK vs ROG · Přátelák". */
    title: string
    meetingStart: string
    gameStart: string
    gameEnd: string
    /** Plain map label, "Foy · den". */
    mapLabel?: string | null
    /** A training's server (shown on its card too); never a password. */
    server?: string | null
    clanName?: string | null
    meetingChannelName?: string | null
    /** The announcement (or its channel) in Discord. */
    announcementUrl?: string | null
    locale: string
    timeZone: string
    copy: MatchAnnouncementCopy
}

function googleUrl(fields: {
    title: string
    start: number
    end: number
    details: string
    location: string
}) {
    const query = [
        ["action", "TEMPLATE"],
        ["text", fields.title],
        ["dates", `${basic(fields.start)}/${basic(fields.end)}`],
        ...(fields.details ? [["details", fields.details]] : []),
        ["location", fields.location],
    ]
        .map(
            ([key, value]) =>
                `${key}=${key === "dates" ? value : encodeURIComponent(value ?? "")}`
        )
        .join("&")
    return `https://calendar.google.com/calendar/render?${query}`
}

/**
 * The Google Calendar link: Název "VLK vs ROG · Přátelák", Kdy meeting →
 * end, Kde "Discord · Vlci · kanál Sraz", Popis "Sraz 19:30, start 20:00.
 * Foy · den. Přihláška a zařazení: …". Long parts are dropped, last first, so
 * the link stays within Discord's 512 characters.
 */
export function buildCalendarLink(input: CalendarLinkInput) {
    const { copy } = input
    const start = Date.parse(input.meetingStart)
    const end = Date.parse(input.gameEnd)
    const safeStart = Number.isFinite(start) ? start : Date.now()
    const safeEnd =
        Number.isFinite(end) && end > safeStart
            ? end
            : safeStart + FALLBACK_LENGTH_MS
    const meeting = clanClock(input.meetingStart, input.locale, input.timeZone)
    const gameStart = clanClock(input.gameStart, input.locale, input.timeZone)
    const channel = input.meetingChannelName?.trim()
    const clan = input.clanName?.trim()
    const location = !clan
        ? "Discord"
        : channel
          ? fillTemplate(copy.calendar.where, { clan, channel })
          : fillTemplate(copy.calendar.whereNoChannel, { clan })
    const parts = [
        meeting && gameStart
            ? fillTemplate(copy.calendar.times, {
                  meeting,
                  start: gameStart,
              })
            : undefined,
        input.kind === "match" && input.mapLabel?.trim()
            ? `${plainText(input.mapLabel)}.`
            : undefined,
        input.kind === "training" && input.server?.trim()
            ? fillTemplate(copy.calendar.server, {
                  server: input.server.trim(),
              })
            : undefined,
        input.announcementUrl
            ? fillTemplate(
                  input.kind === "match"
                      ? copy.calendar.signup
                      : copy.calendar.trainingSignup,
                  { url: input.announcementUrl }
              )
            : undefined,
    ].filter((part): part is string => Boolean(part))
    let title = plainText(input.title).slice(0, 120)
    for (let keep = parts.length; keep >= 0; keep -= 1) {
        const url = googleUrl({
            title,
            start: safeStart,
            end: safeEnd,
            details: parts.slice(0, keep).join(" "),
            location,
        })
        if (url.length <= MAX_URL) return url
    }
    // A very long title or place: shorten the title until the link fits.
    while (title.length > 10) {
        title = title.slice(0, Math.floor(title.length * 0.75))
        const url = googleUrl({
            title,
            start: safeStart,
            end: safeEnd,
            details: "",
            location: location.slice(0, 80),
        })
        if (url.length <= MAX_URL) return url
    }
    return googleUrl({
        title: title.slice(0, 10),
        start: safeStart,
        end: safeEnd,
        details: "",
        location: "Discord",
    })
}
