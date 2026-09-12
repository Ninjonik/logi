import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import type { AppUser } from "@/types/domain"

const getUsersByIdsReference = makeFunctionReference<"query">(
    "users:getUsersByIds"
)
const listUsersReference = makeFunctionReference<"query">("users:listUsers")

export async function getUsersReadModelByIds(
    userIds: string[],
    guildId?: string
) {
    return await cachedRead(
        ["users-by-id", guildId ?? "all", [...userIds].sort().join(",")],
        // A large roster can exceed Next's 128-tag cache limit. Every user
        // mutation also invalidates this aggregate tag, so it keeps this
        // variable-size read coherent without silently dropping tags.
        [appCacheTags.users()],
        async () =>
            (await fetchQuery(getUsersByIdsReference, {
                userIds,
                guildId,
            })) as AppUser[]
    )
}

export async function listUsersReadModel(guildId?: string) {
    return await cachedRead(
        ["users", guildId ?? "all"],
        [appCacheTags.users()],
        async () =>
            (await fetchQuery(listUsersReference, { guildId })) as AppUser[]
    )
}

export async function listUsersReadModelUncached(guildId?: string) {
    return (await fetchQuery(listUsersReference, { guildId })) as AppUser[]
}
