import { normalizeOptionalArray } from "@/domain/shared/collections";

import { SIGNUP_ATTENDING, SIGNUP_NOT_ATTENDING, type EventParticipant, type EventSignup } from "./types";

export function normalizeParticipants(
  participants: EventParticipant[] | undefined,
  signUps: EventSignup[] | undefined,
  nowIso: string,
): EventParticipant[] {
  if (Array.isArray(participants) && participants.length > 0) {
    return participants;
  }

  return normalizeOptionalArray(signUps).map((signUp) => ({
    userId: signUp.userId,
    status: signUp.group && signUp.group !== SIGNUP_NOT_ATTENDING ? "attending" as const : "not_attending" as const,
    group: signUp.group ?? null,
    updatedAt: nowIso,
  }));
}

export function participantsToSignUps(participants: EventParticipant[]): EventSignup[] {
  return participants.map((participant) => ({
    userId: participant.userId,
    group: participant.status === "attending" ? (participant.group ?? SIGNUP_ATTENDING) : SIGNUP_NOT_ATTENDING,
  }));
}
