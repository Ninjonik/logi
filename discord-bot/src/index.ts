import { registerMembershipInvalidationEvents } from "./sync/membership-events"
import { startManagedRoleWorker } from "./sync/managed-member-roles"
import { Worker } from "node:worker_threads"
import { createRequire } from "node:module"
import { Events } from "discord.js"

import {
    removeGuildMemberAccess,
    syncGuildMemberAccessMember,
    invalidateMembershipGuild,
} from "./sync/member-access"
import { MeetingAttendanceRequestService } from "./meeting-attendance"
import { ManualReminderRequestService } from "./manual-reminders"
import { startPlatformStatusMonitor } from "./platform-status"
import { DiscordSyncService } from "./runtime/sync-service"
import { createInteractionHandler } from "./interactions"
import { logError, logInfo, logWarn } from "./log"
import { client } from "./discord-client"
import { env } from "./environment"

const syncService = new DiscordSyncService(client)
const meetingAttendanceRequestService = new MeetingAttendanceRequestService(
    client
)
const manualReminderRequestService = new ManualReminderRequestService(
    client,
    (eventId) => syncService.loadEventPayload(eventId)
)
const require = createRequire(import.meta.url)

function getWorkerExecArgv() {
    const hasTsxLoader = process.execArgv.some((value) =>
        value.includes("tsx/dist/loader.mjs")
    )
    if (hasTsxLoader) {
        return process.execArgv
    }

    return [
        "--require",
        require.resolve("tsx/preflight"),
        "--import",
        import.meta.resolve("tsx"),
    ]
}

function triggerPollSoon() {
    logInfo("bot", "Requested near-term sync flush")
    syncService.triggerSoon()
}

const interactionHandler = createInteractionHandler({
    enqueueEventSync: (eventId) => syncService.queueEventSync(eventId),
    triggerPollSoon,
})

function startFallbackWorker() {
    const fallbackWorker = new Worker(
        new URL("./runtime/fallback-worker.ts", import.meta.url),
        {
            execArgv: getWorkerExecArgv(),
        }
    )

    fallbackWorker.on(
        "message",
        (message: {
            type: string
            eventIds?: string[]
            error?: string
            count?: number
            removed?: number
            released?: number
        }) => {
            if (message.type === "scheduledJobsRecovered") {
                logInfo("fallback-worker", "Recovered scheduled job queue", {
                    removed: message.removed ?? 0,
                    released: message.released ?? 0,
                })
                return
            }

            if (message.type === "scheduledJobsClaimed") {
                logInfo("fallback-worker", "Claimed due scheduled jobs", {
                    count: message.count ?? 0,
                    eventIds: message.eventIds ?? [],
                })
                return
            }

            if (message.type === "attendanceRemindersDue") {
                for (const eventId of message.eventIds ?? []) {
                    syncService.queueAttendanceReminder(eventId)
                }
                syncService.triggerSoon(250)
                return
            }

            if (message.type === "signupRemindersDue") {
                for (const eventId of message.eventIds ?? []) {
                    syncService.queueSignupReminder(eventId)
                }
                syncService.triggerSoon(250)
                return
            }

            if (message.type === "eventsChanged") {
                logInfo("fallback-worker", "Received changed events", {
                    eventIds: message.eventIds ?? [],
                    count: message.eventIds?.length ?? 0,
                })
                for (const eventId of message.eventIds ?? []) {
                    syncService.queueEventSync(eventId)
                }
                syncService.triggerSoon(250)
                return
            }

            if (message.type === "fullResync") {
                logInfo("fallback-worker", "Requested full resync")
                syncService.requestFullResync()
                return
            }

            if (message.type === "error") {
                logError("fallback-worker", "Worker reported an error", {
                    error: message.error,
                })
            }
        }
    )
    fallbackWorker.on("error", (error) => {
        logError("fallback-worker", "Worker crashed", { error })
    })
    fallbackWorker.on("exit", (code) => {
        if (code !== 0) {
            logWarn("fallback-worker", "Worker exited unexpectedly", { code })
            setTimeout(() => {
                logInfo("fallback-worker", "Restarting fallback worker")
                startFallbackWorker()
            }, 1000)
        }
    })

    return fallbackWorker
}

import {
    startPublicPanelWorker,
    handlePublicPanelButton,
} from "./public-panels/worker"
import { startTeamRequestNotificationWorker } from "./sync/team-request-worker"
import { startReportRecovery } from "./player-reports"
import { startLeagueWorker } from "./league/worker"
client.once(Events.ClientReady, async (readyClient) => {
    startReportRecovery(client)
    startLeagueWorker(client)
    startPublicPanelWorker(client)
    startManagedRoleWorker(client)
    startTeamRequestNotificationWorker(client)
    try {
        logInfo("bot", "Discord bot ready", {
            user: readyClient.user.tag,
            guildCount: readyClient.guilds.cache.size,
        })

        for (const guild of readyClient.guilds.cache.values()) {
            await invalidateMembershipGuild(guild.id)
            await interactionHandler
                .registerGuildCommands(guild)
                .catch((error) => {
                    logError("bot", "Failed to register guild commands", {
                        guildId: guild.id,
                        error,
                    })
                })
        }

        await meetingAttendanceRequestService.start()
        await syncService.start()
        // A backend without the reminder queue must not stop the rest of the
        // bot from starting; reminders then simply wait for the deploy.
        await manualReminderRequestService.start().catch((error) =>
            logError("bot", "Manual reminder requests failed to start", {
                error,
            })
        )
        startPlatformStatusMonitor(client)

        startFallbackWorker()
    } catch (error) {
        logError("bot", "Ready handler failed", { error })
    }
})

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isButton()) {
            if (await handlePublicPanelButton(interaction)) return
            await interactionHandler.handleButtonInteraction(interaction)
            return
        }

        if (interaction.isChannelSelectMenu()) {
            await interactionHandler.handleChannelSelectMenuInteraction(
                interaction
            )
            return
        }

        if (interaction.isStringSelectMenu()) {
            await interactionHandler.handleStringSelectMenuInteraction(
                interaction
            )
            return
        }

        if (interaction.isModalSubmit()) {
            await interactionHandler.handleModalSubmit(interaction)
            return
        }

        if (interaction.isAutocomplete()) {
            await interactionHandler.handleAutocompleteInteraction(interaction)
            return
        }

        if (interaction.isChatInputCommand()) {
            await interactionHandler.handleChatInputCommand(interaction)
        }
    } catch (error) {
        logError("interaction", "Discord interaction failed", {
            type: interaction.type,
            customId:
                "customId" in interaction ? interaction.customId : undefined,
            commandName:
                "commandName" in interaction
                    ? interaction.commandName
                    : undefined,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            error,
        })

        if (interaction.isRepliable()) {
            const message =
                "Something went wrong while handling that interaction."
            if (interaction.deferred || interaction.replied) {
                await interaction
                    .followUp({ content: message, ephemeral: true })
                    .catch(() => null)
            } else {
                await interaction
                    .reply({ content: message, ephemeral: true })
                    .catch(() => null)
            }
        }
    }
})

registerMembershipInvalidationEvents(client, {
    invalidate: invalidateMembershipGuild,
    reconcile: () => syncService.requestFullResync(),
    failed: (guildId, error) =>
        logWarn("member-access", "Membership invalidation failed", {
            guildId,
            error,
        }),
})
client.on(Events.GuildMemberAdd, (member) => {
    const config = syncService.getGuildConfig(member.guild.id)
    void syncGuildMemberAccessMember(
        member,
        config?.dashboardAdminRoleId
    ).catch((error) =>
        logError("member-access", "Failed to add member access", {
            guildId: member.guild.id,
            userId: member.id,
            error,
        })
    )
})
client.on(Events.GuildMemberUpdate, (_before, member) => {
    const config = syncService.getGuildConfig(member.guild.id)
    void syncGuildMemberAccessMember(
        member,
        config?.dashboardAdminRoleId
    ).catch((error) =>
        logError("member-access", "Failed to update member access", {
            guildId: member.guild.id,
            userId: member.id,
            error,
        })
    )
})
client.on(Events.GuildMemberRemove, (member) => {
    void removeGuildMemberAccess(member.guild.id, member.id).catch((error) =>
        logError("member-access", "Failed to remove member access", {
            guildId: member.guild.id,
            userId: member.id,
            error,
        })
    )
})

client.on(Events.Error, (error) => {
    logError("discord-client", "Discord client error", { error })
})
client.on(Events.Warn, (message) => {
    logWarn("discord-client", "Discord client warning", { message })
})
client.on(Events.ShardError, (error, shardId) => {
    logError("discord-client", "Discord shard error", { shardId, error })
})

void client.login(env.botToken).catch((error) => {
    logError("bot", "Discord login failed", { error })
})
