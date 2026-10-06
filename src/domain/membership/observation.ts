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
 * Whether a new provider observation changes what the membership projections
 * serve: state, the role set and the epoch. A reconciliation observes every
 * member every few minutes; one that sees the same roles again is fresher
 * evidence (`observedAt`), not a change, so it must not allocate a revision
 * or a change-feed entry (ARCHITECTURE.md, "Convex hot paths").
 */
export function observationChanged(
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
): boolean {
    return (
        !previous ||
        previous.state !== next.state ||
        previous.epoch !== next.epoch ||
        (previous.unavailable ?? false) !== next.unavailable ||
        previous.roleIds.length !== next.roleIds.length ||
        previous.roleIds.some((roleId, index) => roleId !== next.roleIds[index])
    )
}
