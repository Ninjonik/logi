/**
 * "Zobrazit přihlášené" (board L1 1.9): a private, paged list of who signed
 * up, by group, with the reserves and who is not coming. Leadership also sees
 * the reasons, "Bez odpovědi" and two actions (L1-B09). Up to 40 names fit on
 * a page; longer lists page with "Předchozí · 2 / 2 · Další" (L1-B10).
 */

import {
    filterSignupList,
    paginateSignupList,
    SIGNUP_LIST_PAGE_NAMES,
    type SignupList,
    type SignupListEntry,
    type SignupListFilter,
    type SignupListMembership,
    type SignupListSection,
} from "@/domain/events/signup-list"

import {
    escapeMarkdownText,
    type ChipTone,
    type MessageBlock,
    type MessageButton,
    type MessageSelectOption,
    type MessageView,
} from "./message-view"
import {
    matchCardFullTitle,
    weekdayAt,
    weekdayTime,
    type MatchCardEvent,
} from "./match-announcement"
import type { MatchAnnouncementCopy } from "./match-announcement-copy"
import { discordTimestamp, fillTemplate, formatCount } from "./format"
import { DEFAULT_CHIP_ICONS } from "./message-layout"

/** Room for the sections on one page; the header, meta and footer use the rest. */
const SECTION_TEXT_BUDGET = 3_300

const MEMBERSHIP_TONES: Record<SignupListMembership, ChipTone> = {
    member: "success",
    reserve_member: "info",
    recruit: "warning",
    mercenary: "neutral",
}

export type AttendeesViewInput = {
    event: MatchCardEvent
    list: SignupList
    filter: SignupListFilter
    /** 1-based; clamped to the pages there are. */
    page: number
    leadership: boolean
    /** Sign-ups are still open (meta "přihlášky do …"). */
    registrationOpen: boolean
    /** Display names; a missing one shows as a Discord mention. */
    names: ReadonlyMap<string, string>
    /** Leadership: "Připomenout bez odpovědi" can be sent now. */
    reminderAvailable?: boolean
    /**
     * Leadership: the reminder is off because sign-ups closed; the card says
     * so under the button (L1-84, resolution in INDEX).
     */
    reminderClosed?: boolean
    /** Leadership: the match's attendance page in Logi. */
    webUrl?: string | null
    copy: MatchAnnouncementCopy
}

/** Custom IDs of the list's controls. */
export const ATTENDEES_PREFIX = "attendees:"
export const ATTENDEES_FILTER_PREFIX = "attendees-filter:"
export const ATTENDEES_PAGE_PREFIX = "attendees-page:"
export const ATTENDEES_REMIND_PREFIX = "attendees-remind:"

/** "all", a group ID or "unanswered" as one custom-ID segment. */
export function encodeSignupListFilter(filter: SignupListFilter) {
    return filter.kind === "group"
        ? `g.${filter.id}`
        : filter.kind === "unanswered"
          ? "none"
          : "all"
}

export function decodeSignupListFilter(
    value: string | undefined
): SignupListFilter {
    if (value === "none") return { kind: "unanswered" }
    if (value?.startsWith("g.") && value.length > 2)
        return { kind: "group", id: value.slice(2) }
    return { kind: "all" }
}

/** `attendees-page:<event>:<filter>:<page>`. */
export function attendeesPageId(
    eventId: string,
    filter: SignupListFilter,
    page: number | "none"
) {
    return `${ATTENDEES_PAGE_PREFIX}${eventId}:${encodeSignupListFilter(filter)}:${page}`
}

export function parseAttendeesCustomId(customId: string) {
    const [prefix, eventId = "", filter, page] = customId.split(":")
    return {
        prefix: `${prefix}:`,
        eventId,
        filter: decodeSignupListFilter(filter),
        page: Number.parseInt(page ?? "1", 10) || 1,
    }
}

function nameOf(userId: string, names: ReadonlyMap<string, string>) {
    const name = names
        .get(userId)
        ?.replace(/[\s\p{Cc}]+/gu, " ")
        .trim()
    if (name) return escapeMarkdownText(name.slice(0, 64))
    // Without a stored name a mention still shows the member (nobody is pinged).
    return /^\d{17,20}$/.test(userId)
        ? `<@${userId}>`
        : escapeMarkdownText(userId)
}

function membershipChip(
    membership: SignupListMembership | null,
    copy: MatchAnnouncementCopy
) {
    return membership
        ? `${DEFAULT_CHIP_ICONS[MEMBERSHIP_TONES[membership]]} ${copy.attendees.memberships[membership]}`
        : undefined
}

/** "po 18:04": the sign-up weekday in the clan zone and the time as a Discord timestamp. */
function signedUpAt(event: MatchCardEvent, iso: string | null) {
    if (!iso) return undefined
    const time = discordTimestamp(iso, "t")
    if (!time) return undefined
    let weekday: string
    try {
        weekday = new Intl.DateTimeFormat(event.locale, {
            weekday: "short",
            timeZone: event.timeZone,
        }).format(Date.parse(iso))
    } catch {
        return time
    }
    return `${weekday.replace(/\.$/, "")} ${time}`
}

/** One row: "**Bizon** · 🟢 Člen · přijde později (20:15) · po 19:02" (L1-75, L1-76, L1-77). */
function entryRow(
    section: SignupListSection,
    entry: SignupListEntry,
    input: AttendeesViewInput
) {
    const { copy } = input
    const late = entry.late
        ? entry.late.arrival
            ? fillTemplate(copy.attendees.lateAt, { time: entry.late.arrival })
            : copy.attendees.late
        : undefined
    const requested =
        section.kind === "reserves" && entry.requestedGroup?.trim()
            ? fillTemplate(copy.attendees.originally, {
                  group: escapeMarkdownText(entry.requestedGroup.trim()),
              })
            : undefined
    return [
        `**${nameOf(entry.userId, input.names)}**`,
        membershipChip(entry.membership, copy),
        late,
        requested,
        signedUpAt(input.event, entry.at),
    ]
        .filter(Boolean)
        .join(" · ")
}

/** "Kos · nemoc" for leadership, the bare name for members (L1-78, L1-81). */
function inlineName(
    section: SignupListSection,
    entry: SignupListEntry,
    input: AttendeesViewInput
) {
    const name = nameOf(entry.userId, input.names)
    if (section.kind !== "declined" || !section.withReasons) return name
    const reason = entry.reason?.replace(/[\s\p{Cc}]+/gu, " ").trim()
    return `**${name}** · ${reason ? escapeMarkdownText(reason.slice(0, 120)) : input.copy.attendees.noReason}`
}

function isInline(section: SignupListSection) {
    return section.kind === "declined" || section.kind === "unanswered"
}

function sectionHeader(section: SignupListSection, input: AttendeesViewInput) {
    const text = input.copy.attendees
    const count = String(section.entries.length)
    switch (section.kind) {
        case "group": {
            const name = `**${escapeMarkdownText(section.name)}**`
            if (section.max === undefined)
                return `${name} · ${section.count} · ${text.unlimited}`
            const capped = `${name} · ${section.count}/${section.max}`
            return section.count >= section.max
                ? `${capped} · ${text.full}`
                : capped
        }
        case "attending":
            return `**${fillTemplate(text.attending, { count })}**`
        case "reserves":
            return section.general
                ? `**${fillTemplate(text.general, { count })}** · ${text.generalNote}`
                : `**${fillTemplate(text.reserves, { count })}** · ${text.reservesNote}`
        case "declined":
            return section.withReasons
                ? `**${fillTemplate(text.declined, { count })}** · ${text.declinedNote}`
                : `**${fillTemplate(text.declined, { count })}**`
        case "unanswered":
            return `**${fillTemplate(text.unanswered, { count })}** · ${text.unansweredNote}`
    }
}

const INLINE_JOIN = " · "
const REASON_JOIN = "  ·  "

function chunkText(
    chunk: {
        section: SignupListSection
        entries: SignupListEntry[]
        start: number
    },
    input: AttendeesViewInput
) {
    const header = sectionHeader(chunk.section, input)
    if (!chunk.entries.length) return header
    if (isInline(chunk.section)) {
        const join =
            chunk.section.kind === "declined" && chunk.section.withReasons
                ? REASON_JOIN
                : INLINE_JOIN
        return `${header}\n${chunk.entries
            .map((entry) => inlineName(chunk.section, entry, input))
            .join(join)}`
    }
    return `${header}\n${chunk.entries
        .map(
            (entry, index) =>
                `${chunk.start + index + 1}. ${entryRow(chunk.section, entry, input)}`
        )
        .join("\n")}`
}

/** The pages of the list for one viewer and filter. */
export function attendeePages(input: Omit<AttendeesViewInput, "page">) {
    const sections = filterSignupList(input.list.sections, input.filter)
    return paginateSignupList(sections, {
        maxNames: SIGNUP_LIST_PAGE_NAMES,
        maxCost: SECTION_TEXT_BUDGET,
        headerCost: (section) =>
            sectionHeader(section, input as AttendeesViewInput).length + 1,
        entryCost: (section, entry) =>
            (isInline(section)
                ? inlineName(section, entry, input as AttendeesViewInput).length
                : entryRow(section, entry, input as AttendeesViewInput).length +
                  5) + 3,
    })
}

function filterOptions(input: AttendeesViewInput): MessageSelectOption[] {
    const text = input.copy.attendees
    const locale = input.event.locale
    const options: MessageSelectOption[] = [
        {
            value: "all",
            label: text.filterAll,
            description: formatCount(
                locale,
                input.list.summary.signedUp,
                text.signedUpCount
            ),
            default: input.filter.kind === "all",
        },
    ]
    for (const section of input.list.sections) {
        if (section.kind !== "group") continue
        options.push({
            value: encodeSignupListFilter({ kind: "group", id: section.id }),
            label: fillTemplate(text.filterGroup, {
                group: section.name,
            }).slice(0, 100),
            description: formatCount(locale, section.count, text.signedUpCount),
            default:
                input.filter.kind === "group" && input.filter.id === section.id,
        })
    }
    // Leadership can narrow the list to the members without an answer (L1-86).
    if (input.leadership) {
        const unanswered = input.list.sections.find(
            (section) => section.kind === "unanswered"
        )
        options.push({
            value: "none",
            label: text.filterUnanswered,
            description: formatCount(
                locale,
                unanswered?.entries.length ?? 0,
                text.memberCount
            ),
            default: input.filter.kind === "unanswered",
        })
    }
    return options.slice(0, 25)
}

/** The private list view with its page, filter and (leadership) actions. */
export function buildAttendeesView(input: AttendeesViewInput): {
    view: MessageView
    page: number
    pages: number
} {
    const { copy, event } = input
    const text = copy.attendees
    const pages = attendeePages(input)
    const pageCount = Math.max(1, pages.length)
    const page = Math.min(Math.max(1, Math.floor(input.page)), pageCount)
    const chunks = pages[page - 1] ?? []

    const counts = input.list.summary.counts
    const summary = [
        `**${fillTemplate(text.summary, { count: String(input.list.summary.signedUp) })}**`,
        ...(event.kind === "match"
            ? counts.groups.map((group) =>
                  group.max === undefined
                      ? `${escapeMarkdownText(group.name)} ${group.count}`
                      : `${escapeMarkdownText(group.name)} ${group.count}/${group.max}`
              )
            : []),
    ].join(" · ")
    const start = weekdayTime(event, event.gameStart)
    const deadline = input.registrationOpen
        ? weekdayTime(event, event.registrationEnd)
        : weekdayAt(event, event.registrationEnd, copy)
    const meta = fillTemplate(
        input.registrationOpen ? text.metaOpen : text.metaClosed,
        { start, deadline }
    )

    const blocks: MessageBlock[] = [
        { kind: "meta", lines: [{ text: meta }, { text: summary }] },
        {
            kind: "select",
            select: {
                id: `${ATTENDEES_FILTER_PREFIX}${event.eventId}`,
                options: filterOptions(input),
            },
        },
    ]
    // Empty group headers alone would read as a broken list.
    if (!chunks.some((chunk) => chunk.entries.length)) {
        blocks.push({
            kind: "text",
            markdown:
                input.filter.kind === "all" ? text.empty : text.emptyFilter,
        })
    } else {
        for (const chunk of chunks)
            blocks.push({ kind: "text", markdown: chunkText(chunk, input) })
    }
    blocks.push({ kind: "separator", divider: true, spacing: "small" })
    if (pageCount > 1) {
        const id = (target: number) =>
            attendeesPageId(event.eventId, input.filter, target)
        const pager: MessageButton[] = [
            {
                kind: "action",
                id: id(page - 1),
                label: copy.buttons.previous,
                style: "secondary",
                disabled: page <= 1,
            },
            {
                kind: "action",
                id: attendeesPageId(event.eventId, input.filter, "none"),
                label: fillTemplate(text.pageOf, {
                    page: String(page),
                    pages: String(pageCount),
                }),
                style: "secondary",
                disabled: true,
            },
            {
                kind: "action",
                id: id(page + 1),
                label: copy.buttons.next,
                style: "secondary",
                disabled: page >= pageCount,
            },
        ]
        blocks.push({ kind: "buttons", buttons: pager })
    }
    if (input.leadership) {
        const actions: MessageButton[] = [
            {
                kind: "action",
                id: `${ATTENDEES_REMIND_PREFIX}${event.eventId}`,
                label: copy.buttons.remind,
                style: "primary",
                disabled: !input.reminderAvailable,
            },
            ...(input.webUrl
                ? [
                      {
                          kind: "link" as const,
                          url: input.webUrl,
                          label: copy.buttons.openWeb,
                      },
                  ]
                : []),
        ]
        blocks.push({ kind: "buttons", buttons: actions })
        if (!input.reminderAvailable && input.reminderClosed)
            blocks.push({
                kind: "text",
                markdown: `-# ${text.remindClosedBody}`,
            })
    }
    return {
        page,
        pages: pageCount,
        view: {
            accent: "clan",
            ephemeral: true,
            header: {
                title: fillTemplate(text.title, {
                    event: matchCardFullTitle(event, copy),
                }),
            },
            blocks,
            footer: { kind: "managed", notes: [text.footer] },
        },
    }
}
