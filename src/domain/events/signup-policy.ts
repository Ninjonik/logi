import { canAcceptSignups } from "./status";
import { participantsToSignUps } from "./participants";
import type { EventParticipant, EventStatus, SignupMembershipStatus } from "./types";
import { SIGNUP_NOT_ATTENDING } from "./types";

export const DEFAULT_ALLOWED_SIGNUP_STATUSES: SignupMembershipStatus[] = [
  "recruit",
  "member",
  "reserve_member",
  "mercenary",
];

export function isSignupMembershipAllowed(input: {
  event: {
    kind?: "match" | "training";
    allowedSignupStatuses?: SignupMembershipStatus[];
  };
  membershipStatus?: SignupMembershipStatus | null;
}) {
  if (input.event.kind !== "match") {
    return true;
  }

  if (!input.membershipStatus) {
    return false;
  }

  const allowedStatuses = input.event.allowedSignupStatuses?.length
    ? input.event.allowedSignupStatuses
    : DEFAULT_ALLOWED_SIGNUP_STATUSES;

  return allowedStatuses.includes(input.membershipStatus);
}

export function assertSignupMembershipAllowed(input: {
  event: {
    kind?: "match" | "training";
    allowedSignupStatuses?: SignupMembershipStatus[];
  };
  membershipStatus?: SignupMembershipStatus | null;
}) {
  if (!isSignupMembershipAllowed(input)) {
    throw new Error("Your membership status is not allowed to sign up for this match.");
  }
}

export function toggleSignup(input: {
  participants: EventParticipant[];
  event: {
    kind?: "match" | "training";
    registrationEnd: string;
    status?: EventStatus;
    allowedSignupStatuses?: SignupMembershipStatus[];
  };
  userId: string;
  group: string | null;
  now: Date;
  membershipStatus?: SignupMembershipStatus | null;
}) {
  if (!canAcceptSignups(input.event, input.now)) {
    throw new Error("Signups are closed for this event.");
  }

  assertSignupMembershipAllowed({
    event: input.event,
    membershipStatus: input.membershipStatus,
  });

  const existing = input.participants.find((participant) => participant.userId === input.userId);
  let participants = input.participants.filter((participant) => participant.userId !== input.userId);
  const normalizedNextGroup = input.group && input.group !== SIGNUP_NOT_ATTENDING ? input.group : null;
  const nextStatus = input.group === SIGNUP_NOT_ATTENDING ? "not_attending" : "attending";
  const existingGroup = existing?.status === "attending" ? (existing.group ?? null) : null;
  const shouldRemoveSignup = Boolean(
    existing &&
    existing.status === nextStatus &&
    existingGroup === normalizedNextGroup,
  );

  if (!shouldRemoveSignup) {
    participants = [...participants, {
      userId: input.userId,
      status: nextStatus,
      group: normalizedNextGroup,
      updatedAt: input.now.toISOString(),
      completed: existing?.completed,
    }];
  }

  return {
    participants,
    signUps: participantsToSignUps(participants),
    removed: shouldRemoveSignup,
  };
}
