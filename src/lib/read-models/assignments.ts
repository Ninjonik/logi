import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { getInternalAuthSecret } from "@/lib/env"

const listAssignmentsReference = makeFunctionReference<"query">(
    "userAssignments:listForServer"
)
const getAssignmentByIdReference = makeFunctionReference<"query">(
    "userAssignments:getById"
)

export type ServerUserAssignmentReadModel = {
    id: string
    userId: string
    serverId: string
    gameId?: import("@/domain/games/game").GameId
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
    membershipCategoryId?: string
    primaryGroupId?: string
    secondaryGroupIds: string[]
    paused: boolean
    pausedNote?: string
    createdAt: string
    updatedAt: string
}

export async function getServerUserAssignmentsReadModel(
    serverId: string
): Promise<ServerUserAssignmentReadModel[]> {
    return await cachedRead(
        ["assignments", serverId],
        [appCacheTags.assignments(serverId)],
        async () =>
            (await fetchQuery(listAssignmentsReference, {
                secret: getInternalAuthSecret(),
                serverId,
            })) as ServerUserAssignmentReadModel[]
    )
}

export async function getServerUserAssignmentReadModel(assignmentId: string) {
    return await cachedRead(
        ["assignment", assignmentId],
        [appCacheTags.assignment(assignmentId)],
        async () =>
            (await fetchQuery(getAssignmentByIdReference, {
                secret: getInternalAuthSecret(),
                assignmentId: assignmentId as never,
            })) as ServerUserAssignmentReadModel | null
    )
}
