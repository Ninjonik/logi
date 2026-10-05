import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import type { SavePublicInviteResult } from "@/lib/api/public-invite-route"
import { getInternalAuthSecret } from "@/lib/env"

const setInviteUrlReference = makeFunctionReference<"mutation">(
    "clanPublicPage:setInviteUrl"
)

/** Stores (or with `null` removes) the clan's public Discord invite. */
export async function savePublicClanInvite(
    serverId: string,
    inviteUrl: string | null
): Promise<SavePublicInviteResult> {
    return (await fetchMutation(setInviteUrlReference, {
        secret: getInternalAuthSecret(),
        guildId: serverId as never,
        inviteUrl,
    })) as SavePublicInviteResult
}
