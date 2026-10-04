import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { createServerEventsPostHandler } from "@/lib/api/event-route-handlers"
import { completeServerTraining, saveServerEvent } from "@/lib/server-events"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { importServerEventsFromLinks } from "@/lib/server-match-results"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { eventSchema } from "@/lib/validation/event"
import { getSiteUrl } from "@/lib/env"

/** Current server admin with a live dashboard session. */
async function canAdminServer(serverId: string) {
    const [server, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return Boolean(server?.canAdmin && actor)
}

const postHandler = createServerEventsPostHandler({
    origin: new URL(getSiteUrl()).origin,
    eventSchema,
    canAdminServer,
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
