import { registerMembershipInvalidationEvents } from "./sync/membership-events"
import { startScheduledDispatch } from "./runtime/scheduled-dispatch"
import { startManagedRoleWorker } from "./sync/managed-member-roles"
import { stopPreparedModals } from "./interactions/acknowledgement"
import { startEventDeletionWorker } from "./sync/event-deletion"
import { startRequestRecovery } from "./runtime/request-lease"
import { BotLifecycle } from "./runtime/lifecycle"
import { shutdownConvexClient } from "./convex"
import { Worker } from "node:worker_threads"
import { createRequire } from "node:module"
import { Events } from "discord.js"

import {
    removeGuildMemberAccess,
    syncGuildMemberAccessMember,
    invalidateMembershipGuild,
} from "./sync/member-access"
import {
    registerJoinedGuild,
    startCommandRegistration,
    stopCommandRegistration,
} from "./commands/runtime"
import { RosterChangeRequestService } from "./rosters/roster-change-service"
import { handlePreparedModalButton } from "./interactions/acknowledgement"
import { MeetingAttendanceRequestService } from "./meeting-attendance"
import { ManualReminderRequestService } from "./manual-reminders"
import { startPlatformStatusMonitor } from "./platform-status"
import { DiscordSyncService } from "./runtime/sync-service"
import { createInteractionHandler } from "./interactions"
import { runInteraction } from "./interactions/registry"
import { logError, logInfo, logWarn } from "./log"
import { client } from "./discord-client"
import { env } from "./environment"

const lifecycle = new BotLifecycle((service, error) =>
    logError("bot", "Service failed", { service, error })
)
let fallbackWorker: Worker | undefined
let fallbackRestart: ReturnType<typeof setTimeout> | undefined

const syncService = new DiscordSyncService(client)
const meetingAttendanceRequestService = new MeetingAttendanceRequestService(
    client
)
const manualReminderRequestService = new ManualReminderRequestService(
    client,
    (eventId) => syncService.loadEventPayload(eventId)
)
const rosterChangeRequestService = new RosterChangeRequestService(
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
    logInfo("bot", "Requested interactive sync flush")
    syncService.triggerInteractiveFlush()
}

const interactionHandler = createInteractionHandler({
    enqueueEventSync: (eventId) => syncService.queueEventSync(eventId),
    triggerPollSoon,
})

function startFallbackWorker() {
    const worker = new Worker(
        new URL("./runtime/fallback-worker.ts", import.meta.url),
        {
            execArgv: getWorkerExecArgv(),
        }
    )

    worker.on(
        "message",
        (message: {
            type: string
            eventIds?: string[]
            error?: string
            count?: number
            removed?: number
            released?: number
        }) => {
            if (lifecycle.stopped) return
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
    worker.on("error", (error) => {
        logError("fallback-worker", "Worker crashed", { error })
    })
    worker.on("exit", (code) => {
        if (!lifecycle.stopped) {
            logWarn("fallback-worker", "Worker exited unexpectedly", { code })
            fallbackRestart = setTimeout(() => {
                if (lifecycle.stopped) return
                logInfo("fallback-worker", "Restarting fallback worker")
                startFallbackWorker()
            }, 1000)
        }
    })

    fallbackWorker = worker
    return worker
}

import { startApplicationWebSubmissionWorker } from "./interactions/membership-web-submissions"
import { startApplicationStateCache } from "./interactions/membership-application-store"
import { startApplicationEmojiProvisioning } from "./runtime/application-emoji"
import { startTeamRequestNotificationWorker } from "./sync/team-request-worker"
import { startAnnouncementMigration } from "./events/announcement-migration"
import { startPublicPanelWorker } from "./public-panels/worker"
import { startReportRecovery } from "./player-reports"
import { startLeagueWorker } from "./league/worker"
import { startSeedWorker } from "./seed/worker"
client.once(Events.ClientReady, (readyClient) => {
    void lifecycle.start("event deletion", () =>
        startEventDeletionWorker(client, (guildId) => {
            syncService.queueGuildSync(guildId)
            syncService.triggerSoon(250)
        })
    )
    void lifecycle.start("request recovery", () => startRequestRecovery())
    void lifecycle.start("report recovery", () => startReportRecovery(client))
    void lifecycle.start("web applications", () =>
        startApplicationWebSubmissionWorker(client)
    )
    void lifecycle.start("application cache", () =>
        startApplicationStateCache()
    )
    void lifecycle.start("league", () => startLeagueWorker(client))
    void lifecycle.start("public panels", () =>
        startPublicPanelWorker(client, {
            refreshCalendar: (guildId) => syncService.refreshCalendar(guildId),
        })
    )
    void lifecycle.start("managed roles", () => startManagedRoleWorker(client))
    void lifecycle.start("seed", () => startSeedWorker(client))
    void lifecycle.start("team notifications", () => {
        const loop = startTeamRequestNotificationWorker(client)
        return () => loop.stop()
    })
    void lifecycle.start("application emoji", () =>
        startApplicationEmojiProvisioning(client)
    )
    void lifecycle.start(
        "meeting attendance",
        async () => {
            await meetingAttendanceRequestService.start()
        },
        () => meetingAttendanceRequestService.stop()
    )
    void lifecycle.start(
        "sync",
        async () => {
            await syncService.start()
            if (lifecycle.stopped) return
            void lifecycle.start("scheduled dispatch", () =>
                startScheduledDispatch(async (row, delivery) => {
                    for (const eventId of row.changedEventIds)
                        await syncService.enqueueScheduled(
                            eventId,
                            eventId === row.eventId ? row.kind : "sync",
                            delivery,
                            row.dueAt
                        )
                })
            )
            void lifecycle.start("announcement migration", () =>
                startAnnouncementMigration({
                    queueEventSync: (eventId) =>
                        syncService.queueEventSync(eventId),
                    triggerSoon: () => syncService.triggerSoon(250),
                })
            )
            void lifecycle.start(
                "manual reminders",
                async () => {
                    await manualReminderRequestService.start()
                },
                () => manualReminderRequestService.stop()
            )
            void lifecycle.start(
                "roster changes",
                async () => {
                    await rosterChangeRequestService.start()
                },
                () => rosterChangeRequestService.stop()
            )
        },
        () => syncService.stop()
    )
    void lifecycle.start("membership reconciliation", async () => {
        for (const guild of readyClient.guilds.cache.values()) {
            if (lifecycle.stopped) break
            await invalidateMembershipGuild(guild.id)
        }
    })
    void lifecycle.start(
        "command registration",
        async () => {
            await startCommandRegistration(readyClient)
        },
        stopCommandRegistration
    )
    void lifecycle.start("platform status", () =>
        startPlatformStatusMonitor(client)
    )
    void lifecycle.start("fallback", () => {
        startFallbackWorker()
        return async () => {
            if (fallbackRestart) clearTimeout(fallbackRestart)
            const worker = fallbackWorker
            if (!worker || worker.threadId === -1) return
            await new Promise<void>((resolve, reject) => {
                worker.once("exit", () => resolve())
                worker.once("error", reject)
                worker.postMessage({ type: "stop" })
            })
        }
    })
    logInfo("bot", "Discord bot ready", {
        user: readyClient.user.tag,
        guildCount: readyClient.guilds.cache.size,
    })
})

let stopping: Promise<void> | undefined
function shutdown() {
    if (stopping) return stopping
    logInfo("bot", "Stopping intake and draining active work")
    stopPreparedModals()
    const deadline = setTimeout(() => {
        logError(
            "bot",
            "Shutdown drain exceeded 120 seconds; forcing unsuccessful exit"
        )
        process.exit(1)
    }, 120_000)
    deadline.unref()
    stopping = lifecycle
        .stop(async () => {
            await client.destroy()
            await shutdownConvexClient()
        })
        .then(() => {
            clearTimeout(deadline)
            logInfo("bot", "Shutdown drained successfully")
        })
        .catch((error) => {
            logError("bot", "Shutdown failed", { error })
            process.exit(1)
        })
    return stopping
}
process.on("SIGTERM", () => {
    void shutdown()
})
process.on("SIGINT", () => {
    void shutdown()
})

client.on(Events.InteractionCreate, (source) =>
    // Any failure ends in the private "Tohle se nepovedlo" card (M3-08).
    lifecycle.run(() =>
        runInteraction(source, async (interaction) => {
            if (
                interaction.isButton() &&
                (await handlePreparedModalButton(interaction))
            )
                return
            if (interaction.isButton()) {
                // Panel buttons route through the registry (public-panels/interactions.ts).
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
                await interactionHandler.handleAutocompleteInteraction(
                    interaction
                )
                return
            }

            if (interaction.isChatInputCommand())
                await interactionHandler.handleChatInputCommand(interaction)
        })
    )
)

// A server that adds the bot gets the commands at once (M1-18).
client.on(Events.GuildCreate, (guild) => {
    void lifecycle
        .run(() => registerJoinedGuild(client, guild))
        .catch((error) =>
            logError("bot", "Failed to register guild commands", {
                guildId: guild.id,
                error,
            })
        )
})

registerMembershipInvalidationEvents(client, {
    invalidate: async (guildId) => {
        await lifecycle.run(() => invalidateMembershipGuild(guildId))
    },
    reconcile: () => syncService.requestFullResync(),
    failed: (guildId, error) =>
        logWarn("member-access", "Membership invalidation failed", {
            guildId,
            error,
        }),
})
client.on(Events.GuildMemberAdd, (member) => {
    const config = syncService.getGuildConfig(member.guild.id)
    void lifecycle
        .run(() =>
            syncGuildMemberAccessMember(member, config?.dashboardAdminRoleId)
        )
        .catch((error) =>
            logError("member-access", "Failed to add member access", {
                guildId: member.guild.id,
                userId: member.id,
                error,
            })
        )
})
client.on(Events.GuildMemberUpdate, (_before, member) => {
    const config = syncService.getGuildConfig(member.guild.id)
    void lifecycle
        .run(() =>
            syncGuildMemberAccessMember(member, config?.dashboardAdminRoleId)
        )
        .catch((error) =>
            logError("member-access", "Failed to update member access", {
                guildId: member.guild.id,
                userId: member.id,
                error,
            })
        )
})
client.on(Events.GuildMemberRemove, (member) => {
    void lifecycle
        .run(() => removeGuildMemberAccess(member.guild.id, member.id))
        .catch((error) =>
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
