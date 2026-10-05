import type {
    TeamRequestRecord,
    TeamRequestStatus,
} from "@/domain/teams/team-request"
import type { TeamRecord } from "@/domain/teams/team"

/** Appends a further page without duplicating records already loaded. */
export function appendTeamPage(
    items: readonly TeamRecord[],
    page: readonly TeamRecord[]
): TeamRecord[] {
    const seen = new Set(items.map((item) => item.id))
    return [...items, ...page.filter((item) => !seen.has(item.id))]
}

/**
 * Fills `{key}` placeholders in one pass and literally: `$` patterns or
 * placeholders inside a value are never expanded; unknown placeholders stay
 * as written.
 */
export function fillTeamTemplate(
    template: string,
    values: Readonly<Record<string, string>>
): string {
    return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
        Object.prototype.hasOwnProperty.call(values, key)
            ? (values[key] ?? placeholder)
            : placeholder
    )
}

/** Inserts a team name into a `{name}` label literally. */
export function teamActionLabel(template: string, name: string): string {
    return fillTeamTemplate(template, { name })
}

/**
 * A team link that is safe to render as an anchor: an https URL without
 * credentials, with a short label (host and path, no scheme or trailing
 * slash). Anything else is not linked.
 */
export function teamLinkView(
    url: string
): { href: string; label: string } | null {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return null
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
        return null
    const path = parsed.pathname === "/" ? "" : parsed.pathname
    return {
        href: parsed.href,
        label: `${parsed.host}${path}`.replace(/\/$/, ""),
    }
}

/** Badge variant per request status: decided outcomes stand out, closed requests recede. */
export const TEAM_REQUEST_STATUS_BADGE = {
    pending: "outline",
    approved: "default",
    merged: "default",
    rejected: "destructive",
    cancelled: "secondary",
} as const satisfies Record<
    TeamRequestStatus,
    "default" | "secondary" | "destructive" | "outline"
>

/** The team a request is about: a change request names its target team, a new-team request its proposed name. */
export function teamRequestHeading(request: TeamRequestRecord): string {
    return request.kind === "update"
        ? (request.teamName ?? request.proposal.name)
        : request.proposal.name
}

/** What a decided request resulted in: the rejection reason, or the team it created, changed or merged into. */
export type TeamRequestOutcome =
    { kind: "reason"; reason: string } | { kind: "team"; teamId: string } | null
export function teamRequestOutcome(
    request: TeamRequestRecord
): TeamRequestOutcome {
    if (request.status === "rejected" && request.reason)
        return { kind: "reason", reason: request.reason }
    if (
        (request.status === "approved" || request.status === "merged") &&
        request.resultTeamId
    )
        return { kind: "team", teamId: request.resultTeamId }
    return null
}

/** Only a pending request can be withdrawn by its workspace. */
export function canCancelTeamRequest(request: TeamRequestRecord): boolean {
    return request.status === "pending"
}

/**
 * Resulting teams whose name is not already on the row: approved or merged
 * new-team requests. An approved change request names its target team.
 */
export function teamRequestResultIdsToResolve(
    requests: readonly TeamRequestRecord[],
    known: ReadonlySet<string>
): string[] {
    const ids = new Set<string>()
    for (const request of requests) {
        const outcome = teamRequestOutcome(request)
        if (
            outcome?.kind === "team" &&
            !known.has(outcome.teamId) &&
            !(request.kind === "update" && request.teamId === outcome.teamId)
        )
            ids.add(outcome.teamId)
    }
    return [...ids]
}

/** Appends a further page of requests without duplicating loaded rows. */
export function appendTeamRequests(
    items: readonly TeamRequestRecord[],
    page: readonly TeamRequestRecord[]
): TeamRequestRecord[] {
    const seen = new Set(items.map((item) => item.id))
    return [...items, ...page.filter((item) => !seen.has(item.id))]
}

/** Shows a confirmed cancellation without reloading the list. */
export function withCancelledTeamRequest(
    items: readonly TeamRequestRecord[],
    requestId: string,
    at: string
): TeamRequestRecord[] {
    return items.map((item) =>
        item.id === requestId && item.status === "pending"
            ? { ...item, status: "cancelled", decidedAt: at }
            : item
    )
}
