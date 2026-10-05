import type { EventParticipant } from "./types"

export type SignupGroupLimit = { groupId: string; max: number }

/**
 * Whether `groupName` has no free place left for `userId`: the attending
 * players of that group other than this player already reach the cap. A
 * player who already holds a place in the group keeps it.
 */
export function isSignupGroupFull(input: {
    participants: readonly EventParticipant[]
    userId: string
    groupName: string
    max: number | undefined
}): boolean {
    if (input.max === undefined) return false
    const taken = input.participants.filter(
        (participant) =>
            participant.userId !== input.userId &&
            participant.status === "attending" &&
            participant.group === input.groupName
    ).length
    return taken >= input.max
}

/** The cap of one group, if the event sets one. */
export function signupGroupLimitFor(
    limits: readonly SignupGroupLimit[] | undefined,
    groupId: string
): number | undefined {
    return limits?.find((limit) => limit.groupId === groupId)?.max
}
