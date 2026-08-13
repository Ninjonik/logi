import { canAcceptSignups } from "@/domain/events/status";
import { SIGNUP_GENERAL, SIGNUP_NOT_ATTENDING, TRAINING_ATTEND } from "@/domain/events/types";
import type { EventRecord } from "@/types/domain";

type SignupGroupLike = {
  id: string;
  name: string;
  color: string;
  discordEmoji?: string;
  discordRoleId?: string;
};

export type SignupLanguageLabels = {
  attend: string;
  generalSignup: string;
  decline: string;
  registrationClosed: string;
  invalidSignupButton: string;
  unableToResolveMembership: string;
  missingRequiredRole: string;
  signupUpdated: string;
  markedNotAttending: string;
};

export function formatSignupUpdatedMessage(template: string, actionLabel: string) {
  return template.replace("{type}", actionLabel);
}

export function getSignupDisplayLabel(
  appliedSignupLabel: string,
  labels: Pick<SignupLanguageLabels, "attend" | "generalSignup" | "decline">,
) {
  if (appliedSignupLabel === TRAINING_ATTEND) {
    return labels.attend;
  }

  if (appliedSignupLabel === SIGNUP_GENERAL) {
    return labels.generalSignup;
  }

  if (appliedSignupLabel === SIGNUP_NOT_ATTENDING) {
    return labels.decline;
  }

  return appliedSignupLabel;
}

export type EventSignupAction =
  | { id: typeof TRAINING_ATTEND; label: string; kind: "attend" }
  | { id: typeof SIGNUP_GENERAL; label: string; kind: "general" }
  | { id: typeof SIGNUP_NOT_ATTENDING; label: string; kind: "decline" }
  | { id: string; label: string; kind: "group"; emoji?: string; color: string };

export function getVisibleSignupGroups(event: Pick<EventRecord, "signupGroupIds">, groups: SignupGroupLike[]) {
  if (!event.signupGroupIds) {
    return groups;
  }

  const configuredGroupIds = new Set(event.signupGroupIds);
  return groups.filter((group) => configuredGroupIds.has(group.id));
}

export function buildEventSignupActions(
  event: Pick<EventRecord, "kind" | "signupGroupIds" | "useGeneralSignup">,
  groups: SignupGroupLike[],
  labels: Pick<SignupLanguageLabels, "attend" | "generalSignup" | "decline">,
): EventSignupAction[] {
  if (event.kind === "training") {
    return [
      { id: TRAINING_ATTEND, label: labels.attend, kind: "attend" },
      { id: SIGNUP_NOT_ATTENDING, label: labels.decline, kind: "decline" },
    ];
  }

  return [
    ...(event.useGeneralSignup ? [{ id: SIGNUP_GENERAL, label: labels.generalSignup, kind: "general" as const } satisfies EventSignupAction] : []),
    ...getVisibleSignupGroups(event, groups).map((group) => ({
      id: group.id,
      label: group.name,
      kind: "group" as const,
      emoji: group.discordEmoji,
      color: group.color,
    })),
    { id: SIGNUP_NOT_ATTENDING, label: labels.decline, kind: "decline" },
  ];
}

export function resolveEventSignupSelection(input: {
  event: Pick<EventRecord, "kind" | "signupGroupIds" | "useGeneralSignup" | "requiredRoleIds" | "registrationEnd" | "status">;
  groups: SignupGroupLike[];
  memberRoleIds?: string[] | null;
  actionId: string;
  labels: Pick<SignupLanguageLabels, "registrationClosed" | "invalidSignupButton" | "unableToResolveMembership" | "missingRequiredRole" | "signupUpdated" | "markedNotAttending">;
}) {
  if (!canAcceptSignups(input.event, new Date())) {
    return { ok: false as const, error: input.labels.registrationClosed };
  }

  if (!input.memberRoleIds) {
    return { ok: false as const, error: input.labels.unableToResolveMembership };
  }

  const memberRoleIds = new Set(input.memberRoleIds);
  const isTrainingAttend = input.event.kind === "training" && input.actionId === TRAINING_ATTEND;
  const isGeneralSignup = input.event.kind === "match" && input.actionId === SIGNUP_GENERAL;
  const selectedGroup = isGeneralSignup || isTrainingAttend || input.actionId === SIGNUP_NOT_ATTENDING
    ? null
    : getVisibleSignupGroups(input.event, input.groups).find((group) => group.id === input.actionId) ?? null;

  if (!selectedGroup && input.actionId !== SIGNUP_NOT_ATTENDING && !isTrainingAttend && !isGeneralSignup) {
    return { ok: false as const, error: input.labels.invalidSignupButton };
  }

  if (input.event.requiredRoleIds.length > 0 && !input.event.requiredRoleIds.some((roleId) => memberRoleIds.has(roleId))) {
    return { ok: false as const, error: input.labels.missingRequiredRole };
  }

  if (selectedGroup?.discordRoleId && !memberRoleIds.has(selectedGroup.discordRoleId)) {
    return { ok: false as const, error: input.labels.missingRequiredRole };
  }

  if (isGeneralSignup && !input.event.useGeneralSignup) {
    return { ok: false as const, error: input.labels.invalidSignupButton };
  }

  return {
    ok: true as const,
    group: isTrainingAttend ? TRAINING_ATTEND : isGeneralSignup ? SIGNUP_GENERAL : (selectedGroup ? selectedGroup.name : SIGNUP_NOT_ATTENDING),
    successMessage: selectedGroup || isTrainingAttend ? input.labels.signupUpdated : input.labels.markedNotAttending,
  };
}
