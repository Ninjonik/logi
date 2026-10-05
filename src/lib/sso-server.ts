import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { isSsoCallback } from "@/domain/identity/sso-policy"
import { createSsoSecret, hashSsoValue } from "@/lib/sso"
import { getSsoProvider } from "./gateways/sso-provider"
import { getInternalAuthSecret } from "@/lib/env"

const listReference = makeFunctionReference<"query">("sso:listForGuild")
const createReference = makeFunctionReference<"mutation">("sso:create")
const removeReference = makeFunctionReference<"mutation">("sso:remove")
const updateReference = makeFunctionReference<"mutation">("sso:update")

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
    const provider = await getSsoProvider()
    const isExactHttpsUrl = (url: string) =>
        isSsoCallback(url, provider.allowLoopbackHttp)
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

/** Changes an application's name, website and return addresses; its client ID and secret stay. */
export async function updateSsoApplication(input: {
    guildId: string
    userId: string
    clientId: string
    name: string
    websiteUrl: string
    redirectUris: string[]
}) {
    const provider = await getSsoProvider()
    const isExactHttpsUrl = (url: string) =>
        isSsoCallback(url, provider.allowLoopbackHttp)
    if (
        !input.name.trim() ||
        !isExactHttpsUrl(input.websiteUrl) ||
        !input.redirectUris.length ||
        !input.redirectUris.every(isExactHttpsUrl)
    ) {
        throw new Error("Use HTTPS URLs and provide at least one redirect URL.")
    }
    await fetchMutation(updateReference, {
        secret: getInternalAuthSecret(),
        guildId: input.guildId,
        userId: input.userId,
        clientId: input.clientId,
        name: input.name.trim(),
        websiteUrl: input.websiteUrl,
        redirectUris: [...new Set(input.redirectUris)],
    })
}
