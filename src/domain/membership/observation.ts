import type { MembershipObservation } from "./observation.schema"

// `membershipObservationSchema` and `projectMembership` live in
// `observation.schema.ts`; the freshness rule and the stored shapes here stay
// free of Zod for the role operations' and the wrapper's paths.
export type { MembershipObservation } from "./observation.schema"
export type MembershipSubject = Pick<
    MembershipObservation,
    "guildId" | "discordUserId" | "gameId"
>
export type ProviderObservation = {
    state: "present" | "left" | "unknown"
    roleIds: string[]
    observedAt: string | null
    retryAfterMs?: number
}
export type StoredObservation = ProviderObservation & {
    receivedAt: string
    epoch: string
    revision: string
    unavailable?: boolean
}
export function isFreshObservation(
    value: StoredObservation | null,
    epoch: string,
    maxAgeMs: number,
    now: number
) {
    if (
        !value ||
        value.epoch !== epoch ||
        value.unavailable ||
        value.state === "unknown" ||
        !value.observedAt ||
        !Number.isFinite(maxAgeMs) ||
        maxAgeMs < 0 ||
        maxAgeMs > 300_000
    )
        return false
    const age = now - Date.parse(value.observedAt)
    return Number.isFinite(age) && age >= 0 && age <= maxAgeMs
}

/**
 * What a new provider observation changes about a stored one:
 *
 * - `"member"`: the state, the role set or availability differ (or nothing
 *   is stored yet). Only this allocates a revision and a change-feed entry.
 * - `"epoch"`: the same member seen under a newer guild epoch. The stored
 *   epoch must follow, because freshness compares it with the guild's, but
 *   nothing the website projections serve changed: their consumers already
 *   reset on an epoch change (`membershipScopeVersion`).
 * - `"none"`: fresher evidence (`observedAt`) of the same member.
 *
 * A reconciliation observes every member of a clan; one that sees the same
 * roles again, even after an invalidation, must not allocate a revision or a
 * change-feed entry per member (ARCHITECTURE.md, "Convex hot paths").
 * `roleIds` are compared in order; callers pass them sorted.
 */
export function observationChange(
    previous: {
        state: ProviderObservation["state"]
        roleIds: string[]
        epoch: string
        unavailable?: boolean
    } | null,
    next: {
        state: ProviderObservation["state"]
        roleIds: string[]
        epoch: string
        unavailable: boolean
    }
): "member" | "epoch" | "none" {
    if (
        !previous ||
        previous.state !== next.state ||
        (previous.unavailable ?? false) !== next.unavailable ||
        previous.roleIds.length !== next.roleIds.length ||
        previous.roleIds.some((roleId, index) => roleId !== next.roleIds[index])
    )
        return "member"
    return previous.epoch === next.epoch ? "none" : "epoch"
}
