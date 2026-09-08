import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { createServerEventsPostHandler } from "@/lib/api/event-route-handlers"
import { completeServerTraining, saveServerEvent } from "@/lib/server-events"
import { importServerEventsFromLinks } from "@/lib/server-match-results"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { eventSchema } from "@/lib/validation/event"

const postHandler = createServerEventsPostHandler({
    eventSchema,
    saveServerEvent,
    concludeServerEvent: async () => {
        throw new Error("Unused.")
    },
    completeServerTraining,
    importServerEventsFromLinks,
    importEventMatchResults: async () => {
        throw new Error("Unused.")
    },
    getEventMetadata: async () => null,
    finalizeTrainingCompletion: async () => undefined,
    revalidateCacheEntries,
    appCacheTags,
    logRouteError,
    getUserSafeErrorMessage,
})

export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    return postHandler(request, context)
}
