import { z } from "zod"

export const selfAssignableGroupIdsSchema = z
    .array(z.string().trim().min(1).max(64))
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Groups must be unique.")

/** Self-service only changes allowlisted secondary groups on an existing membership. */
export function selfAssignedSecondaryGroups(input: {
    allowedGroupIds: readonly string[]
    groupId: string
    enabled: boolean
    assignment: {
        status: string
        paused: boolean
        primaryGroupId?: string
        secondaryGroupIds: string[]
    }
}) {
    if (!input.allowedGroupIds.includes(input.groupId))
        throw new Error("self_groups:not_allowed")
    if (input.assignment.status === "pending" || input.assignment.paused)
        throw new Error("self_groups:membership_required")
    if (input.assignment.primaryGroupId === input.groupId)
        throw new Error("self_groups:primary_group")
    return input.enabled
        ? [...new Set([...input.assignment.secondaryGroupIds, input.groupId])]
        : input.assignment.secondaryGroupIds.filter(
              (id) => id !== input.groupId
          )
}
