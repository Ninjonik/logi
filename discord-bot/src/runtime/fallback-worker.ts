import { runScheduledBatch, type ScheduledClaim } from "./scheduled-batch"
import { TaskOwner, startOwnedInterval } from "./task-owner"
import { parentPort } from "node:worker_threads"
import { shutdownConvexClient } from "../convex"

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

const tasks = new TaskOwner()
let isRunningTick = false
let recoveryCursor: string | null = null

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
        const recovered = (await convex.mutation(
            references.recoverScheduledJobQueue,
            {
                secret: env.internalSecret,
                paginationOpts: { cursor: recoveryCursor, numItems: 100 },
            }
        )) as {
            removed: number
            released: number
            continueCursor: string
            isDone: boolean
        }
        recoveryCursor = recovered.isDone ? null : recovered.continueCursor
        workerPort.postMessage({
            type: "scheduledJobsRecovered",
            removed: recovered.removed,
            released: recovered.released,
        })
        await generateRecurringEvents().catch((error) =>
            workerPort.postMessage({
                type: "error",
                error: error instanceof Error ? error.message : String(error),
            })
        )
        const jobs = (await convex.mutation(references.claimDueScheduledJobs, {
            secret: env.internalSecret,
            limit: RECONCILE_BATCH_SIZE,
            fenced: true,
        })) as ScheduledClaim[]
        if (jobs.length)
            workerPort.postMessage({
                type: "scheduledJobsClaimed",
                count: jobs.length,
                eventIds: jobs.map((job) => job.eventId),
            })
        const batch = await runScheduledBatch(jobs, {
            renew: (claims) =>
                convex.mutation(references.renewScheduledJobClaims, {
                    secret: env.internalSecret,
                    claims: claims.map((job) => ({
                        jobId: job.id,
                        claimVersion: job.claimVersion,
                    })),
                }),
            reconcile: (job) =>
                convex.mutation(references.reconcileStatuses, {
                    secret: env.internalSecret,
                    eventId: job.eventId as never,
                }),
            complete: (job, result) =>
                convex.mutation(references.completeScheduledJob, {
                    secret: env.internalSecret,
                    jobId: job.id as never,
                    claimVersion: job.claimVersion,
                    durable: true,
                    ...result,
                }),
            release: (job) =>
                convex.mutation(references.releaseScheduledJob, {
                    secret: env.internalSecret,
                    jobId: job.id as never,
                    claimVersion: job.claimVersion,
                }),
            failed: (error) =>
                workerPort.postMessage({
                    type: "error",
                    error:
                        error instanceof Error ? error.message : String(error),
                }),
        })
        // The durable inbox is authoritative. No reminder or sync handoff
        // depends on a transient postMessage after its schedule row is deleted.
        if (batch.changedEventIds.length)
            workerPort.postMessage({
                type: "scheduledDispatchesReady",
                count: batch.changedEventIds.length,
            })
    } catch (error) {
        workerPort.postMessage({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
        })
    } finally {
        isRunningTick = false
    }
}

void tasks.run(() =>
    convex
        .mutation(references.backfillMissingScheduledJobs, {
            secret: env.internalSecret,
        })
        .then(() => runTick())
        .catch((error) =>
            workerPort.postMessage({
                type: "error",
                error: error instanceof Error ? error.message : String(error),
            })
        )
)

const stopPoll = startOwnedInterval(
    runTick,
    RECONCILE_INTERVAL_MS,
    (error) => {
        workerPort.postMessage({ type: "error", error: String(error) })
    },
    false
)
workerPort.on("message", (message: { type?: string }) => {
    if (message.type !== "stop") return
    void Promise.all([stopPoll(), tasks.stop()])
        .then(async () => {
            await shutdownConvexClient()
            workerPort.close()
        })
        .catch((error) => {
            workerPort.postMessage({ type: "error", error: String(error) })
            process.exitCode = 1
        })
})
