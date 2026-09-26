import { randomBytes } from "node:crypto"

import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { getInternalAuthSecret } from "@/lib/env"

const listReference = makeFunctionReference<"query">("webhooks:list")
const createReference = makeFunctionReference<"mutation">("webhooks:create")
const updateReference = makeFunctionReference<"mutation">("webhooks:update")
const removeReference = makeFunctionReference<"mutation">("webhooks:remove")
const testReference = makeFunctionReference<"mutation">("webhooks:enqueueTest")
const rotateSecretReference = makeFunctionReference<"mutation">(
    "webhooks:rotateSecret"
)
const listDeliveriesReference = makeFunctionReference<"query">(
    "webhooks:listDeliveries"
)

export const createWebhookSigningSecret = () =>
    randomBytes(32).toString("base64url")
export const listWebhooks = (guildId: string) =>
    fetchQuery(listReference, { secret: getInternalAuthSecret(), guildId })
export const createWebhook = (
    guildId: string,
    url: string,
    eventTypes: string[]
) => {
    const signingSecret = createWebhookSigningSecret()
    return fetchMutation(createReference, {
        secret: getInternalAuthSecret(),
        guildId,
        url,
        eventTypes,
        signingSecret,
    }).then((id) => ({ id: String(id), signingSecret }))
}
export const updateWebhook = (
    guildId: string,
    webhookId: string,
    input: { url?: string; eventTypes?: string[]; enabled?: boolean }
) =>
    fetchMutation(updateReference, {
        secret: getInternalAuthSecret(),
        guildId,
        webhookId: webhookId as never,
        ...input,
    })
export const removeWebhook = (guildId: string, webhookId: string) =>
    fetchMutation(removeReference, {
        secret: getInternalAuthSecret(),
        guildId,
        webhookId: webhookId as never,
    })
export const enqueueWebhookTest = (guildId: string, webhookId: string) =>
    fetchMutation(testReference, {
        secret: getInternalAuthSecret(),
        guildId,
        webhookId: webhookId as never,
    })
export const rotateWebhookSigningSecret = (
    guildId: string,
    webhookId: string
) => {
    const signingSecret = createWebhookSigningSecret()
    return fetchMutation(rotateSecretReference, {
        secret: getInternalAuthSecret(),
        guildId,
        webhookId: webhookId as never,
        signingSecret,
    }).then(() => signingSecret)
}
export const listWebhookDeliveries = (
    guildId: string,
    webhookId: string,
    cursor: string | null = null
) =>
    fetchQuery(listDeliveriesReference, {
        secret: getInternalAuthSecret(),
        guildId,
        webhookId: webhookId as never,
        cursor,
        limit: 50,
    })
