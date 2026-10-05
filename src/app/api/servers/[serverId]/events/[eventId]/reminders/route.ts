import {
    eventRemindersHandler,
    type EventReminderResult,
} from "@/lib/api/event-reminders-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string; eventId: string }> }
const requestManualReminder = makeFunctionReference<"mutation">(
    "eventReminders:requestManual"
)

const handler = eventRemindersHandler({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId) => {
        const [server, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        return server?.canAdmin && actor
            ? {
                  guildId: server.server.discordId,
                  actorDiscordId: actor.subject,
              }
            : null
    },
    request: async (input) =>
        (await fetchMutation(requestManualReminder, {
            secret: getInternalAuthSecret(),
            ...input,
        })) as EventReminderResult,
})

/** Queues reminder DMs to members who have not answered or confirmed. */
export async function POST(request: Request, context: Context) {
    return handler(request, await context.params)
}
