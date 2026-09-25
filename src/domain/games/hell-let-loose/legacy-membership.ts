import type { AssignmentStatus, AssignmentType } from "@/domain/assignments/policy";

export function mapLegacyHllMembershipStatus(input: {
  type: AssignmentType;
  status: AssignmentStatus;
}) {
  if (input.status === "pending") {
    return "pending";
  }

  if (input.status === "recruit") {
    return "recruit";
  }

  return input.type;
}
