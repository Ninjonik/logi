import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { getInternalAuthSecret } from "@/lib/env"

const queueReference = makeFunctionReference<"mutation">(
    "matchRecaps:queueForPublishedResult"
)
const captureBaselinesReference = makeFunctionReference<"query">(
    "matchRecaps:captureBaselines"
)

export async function captureMatchRecapBaselines(
    guildId: string,
    userIds: string[]
) {
    return await fetchQuery(captureBaselinesReference, {
        secret: getInternalAuthSecret(),
        guildId,
        userIds,
    })
}

export async function queueMatchRecaps(eventId: string, baselines: unknown) {
    return await fetchMutation(queueReference, {
        secret: getInternalAuthSecret(),
        eventId: eventId as never,
        baselines: baselines as never,
    })
}
