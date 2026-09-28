import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"

const getReference = makeFunctionReference<"query">("platformSettings:get")
const saveReference = makeFunctionReference<"mutation">("platformSettings:save")

export type PlatformSettings = {
    workspaceGuildId: string
    statusChannelId?: string
}

export async function getPlatformSettings() {
    return (await fetchQuery(getReference, {
        secret: getInternalAuthSecret(),
    })) as PlatformSettings | null
}

export async function savePlatformSettings(settings: PlatformSettings) {
    await fetchMutation(saveReference, {
        secret: getInternalAuthSecret(),
        ...settings,
    })
}
