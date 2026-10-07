import { parentPort } from "node:worker_threads"

import { createRecurrenceGate } from "./recurrence-cadence"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"

// This is the only recurring poll: it advances time-based event states.
const RECONCILE_INTERVAL_MS = 60_000
const RECONCILE_BATCH_SIZE = 25
// Weekly match series are extended two weeks ahead once at start, then at
// most every 15 minutes; the pass reads every series, so it never runs per tick.
const recurrenceGate = createRecurrenceGate()

if (!parentPort) {
    throw new Error("Fallback worker must be started from a worker thread.")
}

const workerPort = parentPort

let isRunningTick = false

process.on("unhandledRejection", (error) => {
    workerPort.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
    })
})

process.on("uncaughtExceptionMonitor", (error) => {
    workerPort.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
    })
})

/** Creates due occurrences of weekly series; the event index then announces them. */
async function generateRecurringEvents() {
    if (!recurrenceGate.claim(Date.now())) return
    const result = (await convex.mutation(references.generateRecurringEvents, {
        secret: env.internalSecret,
    })) as { created: Array<{ eventId: string; guildId: string }> }
    if (!result.created.length) return
    // The dashboard caches the match list; show the new matches there too.
    for (const created of result.created)
        await revalidateAppData({
            type: "event-changed",
            serverId: created.guildId,
            eventId: created.eventId,
        })
    workerPort.postMessage({
        type: "eventsChanged",
        eventIds: result.created.map((created) => created.eventId),
    })
}

async function runTick() {
    if (isRunningTick) {
        return
    }

    isRunningTick = true

    try {
        await generateRecurringEvents().catch((error) =>
            workerPort.postMessage({
                type: "error",
                error: error instanceof Error ? error.message : String(error),
            })
        )
        const changedEventIds: string[] = []
        const scoreEventIds = new Set<string>()
        const jobs = (await convex.mutation(references.claimDueScheduledJobs, {
            secret: env.internalSecret,
            limit: RECONCILE_BATCH_SIZE,
        })) as Array<{
            id: string
            eventId: string
            kind:
                | "close-registration"
                | "registration-start"
                | "start-event"
                | "create-squad-voice-channels"
                | "conclude-event"
                | "attendance-reminder"
                | "signup-reminder"
                | "refresh-announcement"
        }>
        const attendanceReminderEventIds = new Set<string>()
        const signupReminderEventIds = new Set<string>()

        if (jobs.length > 0) {
            workerPort.postMessage({
                type: "scheduledJobsClaimed",
                count: jobs.length,
                eventIds: jobs.map((job) => job.eventId),
            })
        }

        for (const job of jobs) {
            try {
                const result = (await convex.mutation(
                    references.reconcileStatuses,
                    {
                        secret: env.internalSecret,
                        eventId: job.eventId as never,
                    }
                )) as { changedEventIds: string[]; scoreEventIds: string[] }

                changedEventIds.push(...result.changedEventIds)
                if (!changedEventIds.includes(job.eventId))
                    changedEventIds.push(job.eventId)
                for (const eventId of result.scoreEventIds)
                    scoreEventIds.add(eventId)
                await convex.mutation(references.completeScheduledJob, {
                    secret: env.internalSecret,
                    jobId: job.id as never,
                })
                if (job.kind === "attendance-reminder")
                    attendanceReminderEventIds.add(job.eventId)
                if (job.kind === "signup-reminder")
                    signupReminderEventIds.add(job.eventId)
            } catch {
                await convex.mutation(references.releaseScheduledJob, {
                    secret: env.internalSecret,
                    jobId: job.id as never,
                })
            }
        }

        for (const eventId of scoreEventIds) {
            await convex.mutation(references.applyEventScore, {
                secret: env.internalSecret,
                eventId,
            })
        }

        if (changedEventIds.length > 0) {
            workerPort.postMessage({
                type: "eventsChanged",
                eventIds: changedEventIds,
            })
        }
        if (attendanceReminderEventIds.size > 0) {
            workerPort.postMessage({
                type: "attendanceRemindersDue",
                eventIds: [...attendanceReminderEventIds],
            })
        }
        if (signupReminderEventIds.size > 0) {
            workerPort.postMessage({
                type: "signupRemindersDue",
                eventIds: [...signupReminderEventIds],
            })
        }
    } catch (error) {
        workerPort.postMessage({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
        })
    } finally {
        isRunningTick = false
    }
}

void convex
    .mutation(references.recoverScheduledJobQueue, {
        secret: env.internalSecret,
    })
    .then((result) => {
        workerPort.postMessage({ type: "scheduledJobsRecovered", ...result })
        return convex.mutation(references.backfillMissingScheduledJobs, {
            secret: env.internalSecret,
        })
    })
    .then(() => runTick())
    .catch((error) =>
        workerPort.postMessage({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
        })
    )
setInterval(() => {
    void runTick()
}, RECONCILE_INTERVAL_MS)
