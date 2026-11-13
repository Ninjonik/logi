import { deliverTeamRequestNotifications } from "./team-request-notifications"
import { startConvexWorkSignal } from "../runtime/convex-work-signal"
import { makeFunctionReference } from "convex/server"
import { convex, references } from "../convex"
import type { Client } from "discord.js"
import { env } from "../environment"
import { logWarn } from "../log"

/**
 * Sends team-request decision DMs when queued or due. Delivery state lives in
 * Convex (leased claims, retries with backoff), so restarts and several bot
 * processes cannot start the same send twice. Lost Discord confirmations remain
 * uncertain; neither restart nor lease expiry proves a message was not delivered.
 */
export function startTeamRequestNotificationWorker(client: Client) {
    const stop = startConvexWorkSignal(
        "team",
        async () => {
            if (!client.isReady()) return
            await deliverTeamRequestNotifications({
                siteUrl: env.appSiteUrl,
                claim: () =>
                    convex.mutation(references.claimTeamRequestNotifications, {
                        secret: env.internalSecret,
                        durable: true,
                    }),
                fetchUser: (discordUserId) => client.users.fetch(discordUserId),
                begin: (requestId, claimToken) =>
                    convex.mutation(
                        makeFunctionReference<"mutation">(
                            "teamRequestDelivery:begin"
                        ),
                        { secret: env.internalSecret, requestId, claimToken }
                    ),
                mark: async (requestId, outcome, claimToken, messageId) => {
                    const result = await convex.mutation(
                        references.markTeamRequestNotified,
                        {
                            secret: env.internalSecret,
                            requestId,
                            outcome,
                            ...(claimToken ? { claimToken } : {}),
                            ...(messageId ? { messageId } : {}),
                        }
                    )
                    if (!result.ok)
                        throw new Error(
                            "Team request notification receipt ownership lost"
                        )
                    return result
                },
                warn: (message, context) =>
                    logWarn("team-requests", message, context),
            })
        },
        (error) =>
            logWarn("team-requests", "Notification pass failed", { error }),
        client
    )
    return { stop }
}
