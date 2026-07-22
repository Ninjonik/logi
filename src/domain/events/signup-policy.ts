import { canAcceptSignups } from "./status";
import { participantsToSignUps } from "./participants";
import type { EventParticipant, EventStatus } from "./types";
import { SIGNUP_NOT_ATTENDING } from "./types";

export function toggleSignup(input: {
  participants: EventParticipant[];
  event: {
    kind?: "match" | "training";
    registrationEnd: string;
    status?: EventStatus;
  };
  userId: string;
  group: string | null;
  now: Date;
}) {
  if (!canAcceptSignups(input.event, input.now)) {
    throw new Error("Signups are closed for this event.");
  }

  const existing = input.participants.find((participant) => participant.userId === input.userId);
  let participants = input.participants.filter((participant) => participant.userId !== input.userId);
  const normalizedNextGroup = input.group && input.group !== SIGNUP_NOT_ATTENDING ? input.group : null;
  const nextStatus = normalizedNextGroup ? "attending" : "not_attending";
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
  };
}
