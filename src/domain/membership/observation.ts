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
