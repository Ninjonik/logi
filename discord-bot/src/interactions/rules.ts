import { canAcceptSignups } from "../../../src/domain/events/status";
import type { EventInteractionContext, MembershipCategory } from "../types";

export function isSignupOpen(event: Pick<EventInteractionContext["event"], "kind" | "registrationEnd" | "status">) {
  return canAcceptSignups(event, new Date(Date.now()));
}

export function resolveMembershipRoleIds(
  config: {
    clanRoleId?: string;
    membershipSettings?: {
      categories: Pick<MembershipCategory, "id" | "recruitRoleIds" | "finalRoleIds">[];
    };
  },
  type?: "member" | "mercenary",
  status?: "pending" | "recruit" | "active",
  membershipCategoryId?: string,
) {
  if (!type || !status) {
    return [];
  }

  if (status === "pending") {
    return [];
  }

  const roleIds = new Set<string>();
  const category = membershipCategoryId
    ? config.membershipSettings?.categories.find((item) => item.id === membershipCategoryId)
    : undefined;
  if (config.clanRoleId) {
    roleIds.add(config.clanRoleId);
  }
  if (status === "recruit") {
    for (const roleId of category?.recruitRoleIds ?? []) {
      roleIds.add(roleId);
    }
  }
  if (status === "active") {
    for (const roleId of category?.finalRoleIds ?? []) {
      roleIds.add(roleId);
    }
  }

  return [...roleIds];
}
