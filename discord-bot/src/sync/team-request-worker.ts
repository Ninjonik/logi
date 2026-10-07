import {
    deliverTeamRequestNotifications,
    startTeamRequestNotificationLoop,
} from "./team-request-notifications"
import { convex, references } from "../convex"
import type { Client } from "discord.js"
import { env } from "../environment"
import { logWarn } from "../log"

/**
 * Sends team-request decision DMs every minute. Delivery state lives in
 * Convex (leased claims, retries with backoff), so restarts and several bot
 * processes do not send a DM twice within a lease.
 */
export function startTeamRequestNotificationWorker(client: Client) {
    return startTeamRequestNotificationLoop(async () => {
        if (!client.isReady()) return
        await deliverTeamRequestNotifications({
            siteUrl: env.appSiteUrl,
            claim: () =>
                convex.mutation(references.claimTeamRequestNotifications, {
                    secret: env.internalSecret,
                }),
            fetchUser: (discordUserId) =>
                client.users.fetch(discordUserId).catch(() => null),
            mark: (requestId, outcome) =>
                convex.mutation(references.markTeamRequestNotified, {
                    secret: env.internalSecret,
                    requestId,
                    outcome,
                }),
            warn: (message, context) =>
                logWarn("team-requests", message, context),
        })
    })
}
