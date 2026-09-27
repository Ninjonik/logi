import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { createSsoSecret, hashSsoValue, isExactHttpsUrl } from "@/lib/sso"
import { getInternalAuthSecret } from "@/lib/env"

const listReference = makeFunctionReference<"query">("sso:listForGuild")
const createReference = makeFunctionReference<"mutation">("sso:create")
const removeReference = makeFunctionReference<"mutation">("sso:remove")
const revokeReference = makeFunctionReference<"mutation">("sso:revokeForUser")

export async function listSsoApplications(guildId: string) {
    return await fetchQuery(listReference, {
        secret: getInternalAuthSecret(),
        guildId,
    })
}

export async function createSsoApplication(input: {
    guildId: string
    userId: string
    name: string
    websiteUrl: string
    redirectUris: string[]
    backchannelLogoutUri?: string
}) {
    if (
        !input.name.trim() ||
        !isExactHttpsUrl(input.websiteUrl) ||
        !input.redirectUris.length ||
        !input.redirectUris.every(isExactHttpsUrl) ||
        (input.backchannelLogoutUri &&
            !isExactHttpsUrl(input.backchannelLogoutUri))
    ) {
        throw new Error("Use HTTPS URLs and provide at least one redirect URL.")
    }
    const clientId = `logi_${createSsoSecret(18)}`
    const clientSecret = createSsoSecret()
    await fetchMutation(createReference, {
        secret: getInternalAuthSecret(),
        guildId: input.guildId,
        userId: input.userId,
        clientId,
        clientSecretHash: hashSsoValue(clientSecret),
        name: input.name.trim(),
        websiteUrl: input.websiteUrl,
        redirectUris: [...new Set(input.redirectUris)],
        backchannelLogoutUri: input.backchannelLogoutUri,
    })
    return { clientId, clientSecret }
}

export async function removeSsoApplication(
    guildId: string,
    userId: string,
    clientId: string
) {
    await fetchMutation(removeReference, {
        secret: getInternalAuthSecret(),
        guildId,
        userId,
        clientId,
    })
}

export async function revokeSsoTokensForUser(userId: string) {
    await fetchMutation(revokeReference, {
        secret: getInternalAuthSecret(),
        userId,
        now: Date.now(),
    })
}
