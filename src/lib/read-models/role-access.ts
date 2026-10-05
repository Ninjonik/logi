import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import type { ManagerReason } from "@/domain/workspaces/role-access"
import { getInternalAuthSecret } from "@/lib/env"
import { logNextError } from "@/lib/system-logs"

const getOverviewReference = makeFunctionReference<"query">(
    "roleAccess:getOverview"
)

export type RoleAccessOverview = {
    /** Members of the Discord server the bot has stored. */
    members: number
    roleCounts: Array<{ roleId: string; count: number }>
    managers: Array<{
        userId: string
        reasons: ManagerReason[]
        /** Missing for people who never signed in to Logi. */
        name?: string
        avatar?: string
    }>
    managerCount: number
    /** When the stored member access last changed; null before the first sync. */
    updatedAt: string | null
}

/**
 * Role holders and current managers of a clan. Call only after the session
 * and the clan admin right were checked; returns null when the read fails so
 * the settings page still opens.
 */
export async function getRoleAccessOverview(
    serverId: string
): Promise<RoleAccessOverview | null> {
    try {
        return (await fetchQuery(getOverviewReference, {
            secret: getInternalAuthSecret(),
            serverId: serverId as never,
        })) as RoleAccessOverview | null
    } catch (error) {
        logNextError("role-access", "Failed to read the role overview", {
            serverId,
            error,
        })
        return null
    }
}
