import { canAcceptSignups } from "../../../src/domain/events/status";
import type { EventInteractionContext, MembershipCategory } from "../types";

export function isSignupOpen(event: Pick<EventInteractionContext["event"], "kind" | "registrationEnd" | "status">) {
  return canAcceptSignups(event, new Date(Date.now()));
}

export function resolveMembershipRoleIds(
  config: {
    clanRoleId?: string;
    membershipSettings?: {
      categories: Pick<MembershipCategory, "id" | "recruitRoleId" | "finalRoleId">[];
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
  if (status === "recruit" && category?.recruitRoleId) {
    roleIds.add(category.recruitRoleId);
  }
  if (status === "active" && category?.finalRoleId) {
    roleIds.add(category.finalRoleId);
  }

  return [...roleIds];
}
