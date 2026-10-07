import {
    errorCard,
    escapeMarkdownText,
    type MessageView,
} from "../discord-messages/message-view"
import {
    discordWeekdayTimestamp,
    fillTemplate,
} from "../discord-messages/format"
import { channelMention, clockTime, shortDay } from "./text"

/** The `/notice` copy of the commands module (`clan-language/commands.ts`). */
export type NoticeCopy = {
    modalTitle: string
    modalNote: string
    reasonLabel: string
    reasonPlaceholder: string
    savedTitle: string
    savedNote: string
    notSignedUpTitle: string
    notSignedUpBody: string
    signupWhere: string
    startedTitle: string
    startedBody: string
    multipleTitle: string
    multipleBody: string
    eventFallback: string
}

/** An event the person may send a notice for. */
export type NoticeEvent = {
    name: string
    /** The match category ("Přátelák", "Liga"); trainings have none. */
    categoryLabel?: string | null
    gameStart?: string | null
}

/** Discord's modal title limit. */
const MODAL_TITLE_MAX = 45

/**
 * The autocomplete row "VLK vs ROG · Přátelák · ne 11. 10. · 20:00" with the
 * day and time in the clan's language and time zone (M1-B10, M3-15).
 */
export function noticeOptionLabel(
    event: NoticeEvent,
    locale: string,
    timeZone?: string
) {
    const parts = [
        event.name.replace(/\s+/g, " ").trim(),
        event.categoryLabel?.trim(),
        shortDay(event.gameStart, locale, timeZone),
        clockTime(event.gameStart, locale, timeZone),
    ].filter((part): part is string => Boolean(part))
    return parts.join(" · ").slice(0, 100)
}

/** "Přijdu později · VLK vs ROG", cut to Discord's 45 characters. */
export function noticeModalTitle(copy: NoticeCopy, eventName?: string | null) {
    const name = eventName?.replace(/\s+/g, " ").trim() || copy.eventFallback
    const title = fillTemplate(copy.modalTitle, { event: name })
    return title.length <= MODAL_TITLE_MAX
        ? title
        : `${title.slice(0, MODAL_TITLE_MAX - 1)}…`
}

/** The private confirmation (M3-17): the event, the quoted reason, what changes. */
export function noticeSavedView(input: {
    copy: NoticeCopy
    event: NoticeEvent
    reason: string
    locale: string
    timeZone?: string
}): MessageView {
    const { copy, event } = input
    const when = discordWeekdayTimestamp(
        event.gameStart,
        input.locale,
        input.timeZone ?? "UTC"
    )
    const eventLine = [
        escapeMarkdownText(event.name.trim() || copy.eventFallback),
        event.categoryLabel?.trim()
            ? escapeMarkdownText(event.categoryLabel.trim())
            : undefined,
        when,
    ]
        .filter(Boolean)
        .join(" · ")
    const reason = input.reason
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => `> ${escapeMarkdownText(line.trim())}`)
        .join("\n")
    return {
        accent: "clan",
        ephemeral: true,
        header: { title: copy.savedTitle },
        blocks: [
            { kind: "text", markdown: eventLine },
            ...(reason ? [{ kind: "text" as const, markdown: reason }] : []),
            { kind: "text", markdown: copy.savedNote },
        ],
    }
}

/** Not signed up for any upcoming event (M3-18), with where to sign up. */
export function noticeNotSignedUpCard(
    copy: NoticeCopy,
    announcementsChannelId?: string | null
): MessageView {
    const channel = channelMention(announcementsChannelId)
    return errorCard({
        title: copy.notSignedUpTitle,
        body: channel
            ? `${copy.notSignedUpBody} ${fillTemplate(copy.signupWhere, { channel })}`
            : copy.notSignedUpBody,
    })
}

/** The event started in the meantime (M3-19). */
export function noticeStartedCard(
    copy: NoticeCopy,
    eventName?: string | null
): MessageView {
    return errorCard({
        title: fillTemplate(copy.startedTitle, {
            event: eventName?.trim() || copy.eventFallback,
        }),
        body: copy.startedBody,
    })
}

/** The typed text matches several events (M3-20). */
export function noticeMultipleCard(copy: NoticeCopy): MessageView {
    return errorCard({ title: copy.multipleTitle, body: copy.multipleBody })
}
