import { NextRequest, NextResponse } from "next/server"

import {
    createServerEventPatchHandler,
    createServerEventPostHandler,
} from "@/lib/api/event-route-handlers"
import {
    completeServerTraining,
    concludeServerEvent,
    saveServerEvent,
} from "@/lib/server-events"
import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { getEventMetadata, getGuildMetadata } from "@/lib/server-metadata"
import { sendDiscordBotDm, syncDiscordMemberRoleIds } from "@/lib/discord"
import { getDiscordConfigByGuild } from "@/lib/server-discord-settings"
import { eventSchema, eventUpdateSchema } from "@/lib/validation/event"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { importEventMatchResults } from "@/lib/server-match-results"
import { getEventMessages } from "@/lib/clan-language/events"
import { getUsersByIds } from "@/lib/server-user-management"
import { getSiteUrl } from "@/lib/env"

/** Current server admin with a live dashboard session. */
async function canAdminServer(serverId: string) {
    const [server, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return Boolean(server?.canAdmin && actor)
}

const patchHandler = createServerEventPatchHandler({
    origin: new URL(getSiteUrl()).origin,
    // Unknown keys are refused; the template settings may change too.
    eventSchema: eventUpdateSchema,
    canAdminServer,
    saveServerEvent,
    concludeServerEvent,
    completeServerTraining,
    importServerEventsFromLinks: async () => {
        throw new Error("Unused.")
    },
    importEventMatchResults,
    getEventMetadata,
    finalizeTrainingCompletion: async () => undefined,
    revalidateCacheEntries,
    appCacheTags,
    logRouteError,
    getUserSafeErrorMessage,
})

const postHandler = createServerEventPostHandler({
    origin: new URL(getSiteUrl()).origin,
    eventSchema,
    canAdminServer,
    saveServerEvent,
    concludeServerEvent,
    completeServerTraining,
    importServerEventsFromLinks: async () => {
        throw new Error("Unused.")
    },
    importEventMatchResults,
    getEventMetadata,
    finalizeTrainingCompletion: async ({ serverId, eventId, participants }) => {
        const [event, guild, discordConfig] = await Promise.all([
            getEventMetadata(eventId),
            getGuildMetadata(serverId),
            getDiscordConfigByGuild(serverId),
        ])

        if (!event || !guild) {
            return
        }

        const users = await getUsersByIds(
            participants.map((participant) => participant.userId),
            guild.discordId
        )

        const messages = getEventMessages(discordConfig?.defaultLanguage)
        const rewardRoleIds = event.rewardRoleIds ?? []
        const userByDiscordId = new Map(
            users.map((user) => [user.discordId, user])
        )
        const rewardedUserIds: string[] = []
        const dmSentUserIds: string[] = []

        await Promise.all(
            participants.map(async (participant) => {
                if (
                    participant.completed === "passed" &&
                    rewardRoleIds.length > 0
                ) {
                    await syncDiscordMemberRoleIds({
                        discordGuildId: guild.discordId,
                        userId: participant.userId,
                        addRoleIds: rewardRoleIds,
                    })
                    rewardedUserIds.push(participant.userId)
                }

                const user = userByDiscordId.get(participant.userId)
                const displayName = user?.name ?? participant.userId
                const statusLabel =
                    participant.completed === "passed"
                        ? messages.training.resultPassed
                        : messages.training.resultFailed
                const roleLine =
                    participant.completed === "passed" &&
                    rewardRoleIds.length > 0
                        ? ` ${messages.training.rewardGranted}`
                        : ""

                try {
                    await sendDiscordBotDm(
                        participant.userId,
                        messages.training.dmResult
                            .replace("{name}", displayName)
                            .replace("{event}", event.name ?? "training")
                            .replace("{result}", statusLabel)
                            .replace("{reward}", roleLine)
                    )
                    dmSentUserIds.push(participant.userId)
                } catch {
                    // Ignore DM failures so the training completion flow still succeeds.
                }
            })
        )

        return {
            rewardedUserIds,
            dmSentUserIds,
        }
    },
    revalidateCacheEntries,
    appCacheTags,
    logRouteError,
    getUserSafeErrorMessage,
})

export async function PATCH(
    request: Request,
    context: { params: Promise<{ serverId: string; eventId: string }> }
) {
    return patchHandler(request, context)
}

export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string; eventId: string }> }
) {
    return postHandler(request, context)
}
