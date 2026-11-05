import type {
    EventParticipant,
    EventStatus,
    SignupMembershipStatus,
} from "./types"
import { canAcceptSignups, isLateSignupWindow } from "./status"
import { participantsToSignUps } from "./participants"
import { SIGNUP_NOT_ATTENDING } from "./types"

export const DEFAULT_ALLOWED_SIGNUP_STATUSES: SignupMembershipStatus[] = [
    "recruit",
    "member",
    "reserve_member",
    "mercenary",
]

export const DEFAULT_TRAINING_ALLOWED_SIGNUP_STATUSES: SignupMembershipStatus[] =
    ["recruit", "member", "reserve_member"]

export function isSignupMembershipAllowed(input: {
    event: {
        kind?: "match" | "training"
        allowedSignupStatuses?: SignupMembershipStatus[]
        allowNonMembersSignup?: boolean
    }
    membershipStatus?: SignupMembershipStatus | null
}) {
    if (!input.membershipStatus)
        return Boolean(input.event.allowNonMembersSignup)

    const allowedStatuses = input.event.allowedSignupStatuses?.length
        ? input.event.allowedSignupStatuses
        : input.event.kind === "training"
          ? DEFAULT_TRAINING_ALLOWED_SIGNUP_STATUSES
          : DEFAULT_ALLOWED_SIGNUP_STATUSES

    return allowedStatuses.includes(input.membershipStatus)
}

export function assertSignupMembershipAllowed(input: {
    event: {
        kind?: "match" | "training"
        allowedSignupStatuses?: SignupMembershipStatus[]
        allowNonMembersSignup?: boolean
    }
    membershipStatus?: SignupMembershipStatus | null
}) {
    if (!isSignupMembershipAllowed(input)) {
        throw new Error(
            "Your membership status is not allowed to sign up for this event."
        )
    }
}

export function toggleSignup(input: {
    participants: EventParticipant[]
    event: {
        kind?: "match" | "training"
        registrationStart?: string
        registrationEnd: string
        meetingStart?: string
        allowLateSignups?: boolean
        status?: EventStatus
        allowedSignupStatuses?: SignupMembershipStatus[]
        allowNonMembersSignup?: boolean
    }
    lateSignupReason?: string
    userId: string
    group: string | null
    now: Date
    membershipStatus?: SignupMembershipStatus | null
    /** The full capped group the player chose; they get a reserve place. */
    requestedGroup?: string | null
}) {
    if (!canAcceptSignups(input.event, input.now)) {
        throw new Error("Signups are closed for this event.")
    }

    assertSignupMembershipAllowed({
        event: input.event,
        membershipStatus: input.membershipStatus,
    })

    const existing = input.participants.find(
        (participant) => participant.userId === input.userId
    )
    const late =
        isLateSignupWindow(input.event, input.now) &&
        input.group !== SIGNUP_NOT_ATTENDING
    const lateSignupReason = input.lateSignupReason?.trim()
    if (late && (!lateSignupReason || lateSignupReason.length > 1000)) {
        throw new Error(
            "A late signup reason between 1 and 1000 characters is required."
        )
    }
    let participants = input.participants.filter(
        (participant) => participant.userId !== input.userId
    )
    const normalizedNextGroup =
        !late && input.group && input.group !== SIGNUP_NOT_ATTENDING
            ? input.group
            : null
    const nextStatus =
        input.group === SIGNUP_NOT_ATTENDING ? "not_attending" : "attending"
    participants = [
        ...participants,
        {
            userId: input.userId,
            status: nextStatus,
            group: normalizedNextGroup,
            ...(nextStatus === "attending" &&
            !normalizedNextGroup &&
            input.requestedGroup
                ? { requestedGroup: input.requestedGroup }
                : {}),
            updatedAt: input.now.toISOString(),
            completed: existing?.completed,
            ...(late
                ? {
                      lateSignupReason,
                      signedUpLateAt:
                          existing?.signedUpLateAt ?? input.now.toISOString(),
                  }
                : existing?.signedUpLateAt
                  ? {
                        lateSignupReason: existing.lateSignupReason,
                        signedUpLateAt: existing.signedUpLateAt,
                    }
                  : {}),
        },
    ]

    return {
        participants,
        signUps: participantsToSignUps(participants),
        removed: false,
    }
}
