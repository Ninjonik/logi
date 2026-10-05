import {
    countSignups,
    type SignupCounts,
} from "../discord-messages/signup-counts"
import { getResolvedMemberStatus } from "../assignments/policy"
import type { EventNotice, ParticipantStatus } from "./types"

/**
 * Who signed up for a match, for "Zobrazit přihlášené" (board L1 1.9): every
 * offered group with its players in sign-up order, the reserves who chose a
 * full group, who is not coming and, for leadership only, the reasons and
 * the members who did not answer. Pure: names and rendering are the
 * caller's.
 */

/** The membership chip next to a name ("Člen", "Záložník", "Rekrut", "Žoldák"). */
export type SignupListMembership =
    "member" | "reserve_member" | "recruit" | "mercenary"

export type SignupListEntry = {
    userId: string
    /** When the player signed up (or answered), ISO; null when unknown. */
    at: string | null
    membership: SignupListMembership | null
    /** A late notice: the arrival time read from it, if it names one. */
    late?: { arrival: string | null }
    /** The full group a reserve originally chose. */
    requestedGroup?: string | null
    /** Why they are not coming; only in the leadership view. */
    reason?: string | null
}

export type SignupListSection =
    | {
          kind: "group"
          id: string
          name: string
          count: number
          max?: number
          entries: SignupListEntry[]
      }
    /** Sign-ups without groups (trainings, matches without groups). */
    | { kind: "attending"; entries: SignupListEntry[] }
    /**
     * Attending without a group: reserves of a full group, or general
     * sign-ups when the match offers them (`general`).
     */
    | { kind: "reserves"; general: boolean; entries: SignupListEntry[] }
    | { kind: "declined"; withReasons: boolean; entries: SignupListEntry[] }
    | { kind: "unanswered"; entries: SignupListEntry[] }

/** "Skupina: Všechny", one group, or (leadership) "Bez odpovědi". */
export type SignupListFilter =
    { kind: "all" } | { kind: "group"; id: string } | { kind: "unanswered" }

export const SIGNUP_LIST_PAGE_NAMES = 40

export type SignupList = {
    /** "23 přihlášeno · Pěchota 15 · Tanky 6/6 · Recon 2/2". */
    summary: { signedUp: number; counts: SignupCounts }
    sections: SignupListSection[]
}

export type SignupListInput = {
    kind?: "match" | "training"
    groups: ReadonlyArray<{ id: string; name: string }>
    /** Groups the match offers; null or undefined offers every group. */
    offeredGroupIds?: readonly string[] | null
    limits?: ReadonlyMap<string, number>
    /** The match offers a sign-up without a group. */
    generalSignup?: boolean
    participants: ReadonlyArray<{
        userId: string
        status: ParticipantStatus
        group?: string | null
        requestedGroup?: string | null
        updatedAt: string
    }>
    absenceNotices?: ReadonlyArray<
        Pick<EventNotice, "userId" | "reason" | "createdAt"> & {
            kind?: EventNotice["kind"]
        }
    >
    /** The last time each player signed up (sign-up history); else `updatedAt`. */
    signedUpAt?: ReadonlyMap<string, string>
    /** Memberships of the clan's players for the match's game. */
    memberships?: ReadonlyMap<string, SignupListMembership>
    /** Leadership view: reasons and "Bez odpovědi". */
    leadership: boolean
    /** Members who neither signed up nor declined (leadership only). */
    unanswered?: readonly string[]
    /** Display names, only to order "Bez odpovědi" alphabetically. */
    names?: ReadonlyMap<string, string>
    locale?: string
}

const ARRIVAL = /(?:^|[^\d])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/

/**
 * The arrival time a late notice names ("Ve 20:15, končím v práci" → "20:15"),
 * or null. Members see only this, never the text (L1-76).
 */
export function arrivalTimeOf(text: string | null | undefined) {
    const match = text?.match(ARRIVAL)
    return match ? `${match[1]!.padStart(2, "0")}:${match[2]}` : null
}

/**
 * The membership chip of an assignment: an applicant ("pending") or a
 * missing assignment has none.
 */
export function signupListMembership(
    assignment:
        | {
              type?: "member" | "reserve_member" | "mercenary"
              status?: "pending" | "recruit" | "active"
          }
        | null
        | undefined
): SignupListMembership | null {
    if (!assignment?.type || !assignment.status) return null
    const status = getResolvedMemberStatus(assignment.type, assignment.status)
    return status === "pending" ? null : status
}

/**
 * The last "signed up" of each player from the sign-up history; a change of
 * group keeps the original time, a new sign-up after declining starts again.
 */
export function signupTimesFromActivities(
    activities: ReadonlyArray<{
        userId: string
        action: "signed_up" | "changed_role" | "unsigned" | "declined"
        occurredAt: string
    }>
): Map<string, string> {
    const times = new Map<string, string>()
    const ordered = [...activities].sort((left, right) =>
        left.occurredAt.localeCompare(right.occurredAt)
    )
    for (const activity of ordered) {
        if (activity.action === "signed_up")
            times.set(activity.userId, activity.occurredAt)
        else if (
            activity.action === "declined" ||
            activity.action === "unsigned"
        )
            times.delete(activity.userId)
    }
    return times
}

const byTime = (left: SignupListEntry, right: SignupListEntry) => {
    if (left.at && right.at && left.at !== right.at)
        return left.at.localeCompare(right.at)
    if (left.at && !right.at) return -1
    if (!left.at && right.at) return 1
    return left.userId.localeCompare(right.userId)
}

/** Builds the list; `leadership` adds reasons and "Bez odpovědi" (L1-B09). */
export function buildSignupList(input: SignupListInput): SignupList {
    const isMatch = (input.kind ?? "match") === "match"
    const offered = input.offeredGroupIds
        ? new Set(input.offeredGroupIds)
        : null
    const groups = isMatch
        ? input.groups.filter((group) => !offered || offered.has(group.id))
        : []
    const groupIdByKey = new Map<string, string>()
    for (const group of groups) {
        groupIdByKey.set(group.id, group.id)
        groupIdByKey.set(group.name, group.id)
    }
    const notices = new Map(
        (input.absenceNotices ?? []).map((notice) => [notice.userId, notice])
    )
    const entry = (
        participant: SignupListInput["participants"][number],
        extra: Partial<SignupListEntry> = {}
    ): SignupListEntry => ({
        userId: participant.userId,
        at:
            input.signedUpAt?.get(participant.userId) ??
            participant.updatedAt ??
            null,
        membership: input.memberships?.get(participant.userId) ?? null,
        ...extra,
    })

    const byGroup = new Map<string, SignupListEntry[]>(
        groups.map((group) => [group.id, []])
    )
    const reserves: SignupListEntry[] = []
    const attending: SignupListEntry[] = []
    const declined: SignupListEntry[] = []
    const attendingForCounts: Array<{ group?: string | null }> = []

    for (const participant of input.participants) {
        const notice = notices.get(participant.userId)
        const cannotCome =
            participant.status === "not_attending" ||
            notice?.kind === "cannot_come"
        if (cannotCome) {
            declined.push({
                ...entry(participant),
                at: participant.updatedAt ?? null,
                ...(input.leadership
                    ? { reason: notice?.reason.trim() || null }
                    : {}),
            })
            continue
        }
        attendingForCounts.push({ group: participant.group })
        const late =
            notice && notice.kind !== "cannot_come"
                ? { late: { arrival: arrivalTimeOf(notice.reason) } }
                : {}
        if (!groups.length) {
            attending.push(entry(participant, late))
            continue
        }
        const groupId = groupIdByKey.get(participant.group ?? "")
        if (groupId === undefined) {
            reserves.push(
                entry(participant, {
                    ...late,
                    requestedGroup: participant.requestedGroup ?? null,
                })
            )
            continue
        }
        byGroup.get(groupId)!.push(entry(participant, late))
    }

    const counts = countSignups({
        groups,
        signups: attendingForCounts,
        limits: input.limits,
    })
    const sections: SignupListSection[] = []
    if (groups.length) {
        for (const group of counts.groups)
            sections.push({
                kind: "group",
                id: group.id,
                name: group.name,
                count: group.count,
                ...(group.max === undefined ? {} : { max: group.max }),
                entries: byGroup.get(group.id)!.sort(byTime),
            })
        if (reserves.length)
            sections.push({
                kind: "reserves",
                general: Boolean(input.generalSignup),
                entries: reserves.sort(byTime),
            })
    } else if (attending.length) {
        sections.push({ kind: "attending", entries: attending.sort(byTime) })
    }
    if (declined.length)
        sections.push({
            kind: "declined",
            withReasons: input.leadership,
            entries: declined.sort(byTime),
        })
    if (input.leadership && input.unanswered?.length) {
        const collator = new Intl.Collator(input.locale ?? "en")
        const nameOf = (userId: string) => input.names?.get(userId) ?? userId
        sections.push({
            kind: "unanswered",
            entries: [...new Set(input.unanswered)]
                .sort((left, right) =>
                    collator.compare(nameOf(left), nameOf(right))
                )
                .map((userId) => ({
                    userId,
                    at: null,
                    membership: input.memberships?.get(userId) ?? null,
                })),
        })
    }
    return {
        summary: {
            signedUp: groups.length
                ? counts.total - counts.withoutGroup
                : counts.total,
            counts,
        },
        sections,
    }
}

/** The sections a filter keeps; an unknown group falls back to all. */
export function filterSignupList(
    sections: readonly SignupListSection[],
    filter: SignupListFilter
): SignupListSection[] {
    if (filter.kind === "group") {
        const kept = sections.filter(
            (section) => section.kind === "group" && section.id === filter.id
        )
        return kept.length ? kept : [...sections]
    }
    if (filter.kind === "unanswered")
        return sections.filter((section) => section.kind === "unanswered")
    return [...sections]
}

/** A run of one section's entries on one page; numbering continues across pages. */
export type SignupListChunk = {
    section: SignupListSection
    entries: SignupListEntry[]
    /** Index of the first entry within the whole section (0-based). */
    start: number
}

/**
 * Splits the sections into pages of at most `maxNames` names (L1-80,
 * L1-B10) and, when given, at most `maxCost` of text (Discord's 4,000
 * characters). A section that fits on a fresh page is never split; a longer
 * one continues on the next page with its numbering.
 */
export function paginateSignupList(
    sections: readonly SignupListSection[],
    options: {
        maxNames?: number
        maxCost?: number
        /** Text cost of one entry in its section. */
        entryCost?: (
            section: SignupListSection,
            entry: SignupListEntry
        ) => number
        /** Text cost of a section header. */
        headerCost?: (section: SignupListSection) => number
    } = {}
): SignupListChunk[][] {
    const maxNames = Math.max(1, options.maxNames ?? SIGNUP_LIST_PAGE_NAMES)
    const maxCost = options.maxCost ?? Number.POSITIVE_INFINITY
    const entryCost = options.entryCost ?? (() => 0)
    const headerCost = options.headerCost ?? (() => 0)
    const pages: SignupListChunk[][] = [[]]
    let names = 0
    let cost = 0
    const newPage = () => {
        pages.push([])
        names = 0
        cost = 0
    }
    for (const section of sections) {
        const header = headerCost(section)
        const costs = section.entries.map((item) => entryCost(section, item))
        const total = costs.reduce((sum, value) => sum + value, header)
        const fitsHere =
            names + section.entries.length <= maxNames &&
            cost + total <= maxCost
        const fitsAlone = section.entries.length <= maxNames && total <= maxCost
        if (!fitsHere && fitsAlone && pages.at(-1)!.length) newPage()
        let start = 0
        if (!section.entries.length) {
            if (cost + header > maxCost && pages.at(-1)!.length) newPage()
            pages.at(-1)!.push({ section, entries: [], start: 0 })
            cost += header
            continue
        }
        while (start < section.entries.length) {
            let end = start
            let chunkCost = header
            while (
                end < section.entries.length &&
                names + (end - start) < maxNames &&
                cost + chunkCost + costs[end]! <= maxCost
            ) {
                chunkCost += costs[end]!
                end += 1
            }
            if (end === start) {
                // Not even one more name fits: continue on a fresh page, or
                // place one oversized entry alone so paging always advances.
                if (pages.at(-1)!.length) {
                    newPage()
                    continue
                }
                chunkCost += costs[end]!
                end += 1
            }
            pages.at(-1)!.push({
                section,
                entries: section.entries.slice(start, end),
                start,
            })
            names += end - start
            cost += chunkCost
            start = end
            if (start < section.entries.length) newPage()
        }
    }
    return pages.filter((page, index) => page.length || index === 0)
}
