import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import type {
    AppUser,
    DiscordConfig,
    EventRecord,
    GameScope,
    Group,
    Guild,
    Roster,
    SquadPreset,
    StratmapRecord,
    TopicPreset,
} from "@/types/domain"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { isSuperadminDiscordId } from "@/lib/superadmin"
import { getInternalAuthSecret } from "@/lib/env"
import { getLoggedInUser } from "@/lib/auth"

const getServerContextReference = makeFunctionReference<"query">(
    "serverContext:getServerContext"
)
const getServerContextInternalReference = makeFunctionReference<"query">(
    "serverContext:getServerContextInternal"
)

export type ServerContextReadModel = {
    user: AppUser
    server: Guild
    canAdmin: boolean
    hasDashboardAccess: boolean
    memberRoleIds: string[]
    events: EventRecord[]
    topicPresets: TopicPreset[]
    squadPresets: SquadPreset[]
    rosters: Roster[]
    stratmaps: StratmapRecord[]
    groups: Group[]
    assignments: ServerUserAssignment[]
    discordConfig: DiscordConfig | null
}

async function getServerContextSnapshot(
    serverId: string,
    userId: string,
    gameScope?: GameScope
): Promise<ServerContextReadModel | null> {
    return (await fetchQuery(getServerContextReference, {
        userId,
        serverId: serverId as never,
        gameScope,
    })) as ServerContextReadModel | null
}

async function getServerContextSnapshotInternal(
    serverId: string,
    userId: string,
    gameScope?: GameScope
): Promise<ServerContextReadModel | null> {
    return (await fetchQuery(getServerContextInternalReference, {
        secret: getInternalAuthSecret(),
        userId,
        serverId: serverId as never,
        gameScope,
    })) as ServerContextReadModel | null
}

export async function getServerContextReadModel(
    serverId: string,
    gameScope?: GameScope
): Promise<ServerContextReadModel | null> {
    const user = await getLoggedInUser()
    if (!user) {
        return null
    }

    try {
        if (await isSuperadminDiscordId(user.discordId)) {
            return await getServerContextSnapshotInternal(
                serverId,
                user.discordId,
                gameScope
            )
        }

        return await getServerContextSnapshot(
            serverId,
            user.discordId,
            gameScope
        )
    } catch {
        return null
    }
}
