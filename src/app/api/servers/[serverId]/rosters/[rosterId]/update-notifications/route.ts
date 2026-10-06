import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { rosterUpdateNotificationsHandler } from "@/lib/api/roster-update-notifications-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"

export const runtime = "nodejs"

const requestReference = makeFunctionReference<"mutation">(
    "rosterChanges:request"
)
const statusReference = makeFunctionReference<"query">("rosterChanges:status")

/**
 * The roster change digest and the change DMs are sent by the bot in the
 * shared card (boards L1-120..126, L2-35..40). This route only asks for
 * them with the admin's choices; Convex compares the saved roster with the
 * version its previous publish replaced, stored on the server (D5-B04).
 */
const handler = rosterUpdateNotificationsHandler({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId, rosterId) => {
        const [context, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        if (!context?.canAdmin || !actor) return null
        const roster = context.rosters.find((item) => item.id === rosterId)
        if (!roster) return "not_found"
        return {
            roster,
            guildId: context.server.discordId,
            actorId: actor.subject,
        }
    },
    notify: async (input) => {
        const queued = (await fetchMutation(requestReference, {
            secret: getInternalAuthSecret(),
            guildId: input.guildId,
            eventId: input.roster.eventId,
            rosterId: input.roster.id,
            requestedBy: input.actorId,
            notifyPlayers: input.notifyPlayers,
            postDigest: input.postAnnouncement,
            mentionPlayers: input.mentionPlayers,
        })) as { status: string; requestId?: string; hasChanges?: boolean }
        if (queued.status !== "queued" && queued.status !== "nothing")
            throw new Error("Roster change request was refused.")
        return {
            ok: true,
            hasChanges: queued.hasChanges === true,
            ...(queued.requestId ? { requestId: queued.requestId } : {}),
        }
    },
    status: async (guildId, requestId) =>
        (await fetchQuery(statusReference, {
            secret: getInternalAuthSecret(),
            guildId,
            requestId,
        })) as Record<string, unknown> | null,
})

/** Asks the bot to tell players about changes to a published roster; clan admins only. */
export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string; rosterId: string }> }
) {
    return handler.POST(request, await context.params)
}

/** How the bot's change DMs went, for the publish dialog; clan admins only. */
export async function GET(
    request: Request,
    context: { params: Promise<{ serverId: string; rosterId: string }> }
) {
    return handler.GET(request, await context.params)
}
