export type AssignmentType = "member" | "mercenary";
export type AssignmentStatus = "pending" | "recruit" | "active";

export function getResolvedMemberStatus(
  type: AssignmentType,
  status: AssignmentStatus,
): "pending" | "recruit" | "member" | "mercenary" {
  if (status === "pending") return "pending";
  if (status === "recruit") return "recruit";
  return type === "mercenary" ? "mercenary" : "member";
}

export function validateAssignmentGroupIds(input: {
  primaryGroupId?: string;
  secondaryGroupIds: string[];
  validGroupIds: Set<string>;
}) {
  if (input.primaryGroupId && !input.validGroupIds.has(String(input.primaryGroupId))) {
    throw new Error("Primary group does not belong to this server.");
  }

  if (input.secondaryGroupIds.some((groupId) => !input.validGroupIds.has(String(groupId)))) {
    throw new Error("One of the selected secondary groups does not belong to this server.");
  }
}

export function mergeImportedSecondaryGroupIds(input: {
  primaryGroupId?: string;
  existingSecondaryGroupIds: string[];
  importedSecondaryGroupIds: string[];
}) {
  return [...new Set([
    ...input.existingSecondaryGroupIds.map((groupId) => String(groupId)),
    ...input.importedSecondaryGroupIds.map((groupId) => String(groupId)),
  ])].filter((groupId) => groupId !== String(input.primaryGroupId ?? ""));
}
