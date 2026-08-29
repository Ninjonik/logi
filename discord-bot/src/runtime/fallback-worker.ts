import { parentPort } from "node:worker_threads";

import { convex, references } from "../convex";
import { env } from "../environment";

// This is the only recurring poll: it advances time-based event states.
const RECONCILE_INTERVAL_MS = 60_000;
const RECONCILE_BATCH_SIZE = 25;

if (!parentPort) {
  throw new Error("Fallback worker must be started from a worker thread.");
}

const workerPort = parentPort;

let isRunningTick = false;

process.on("unhandledRejection", (error) => {
  workerPort.postMessage({
    type: "error",
    error: error instanceof Error ? error.message : String(error),
  });
});

process.on("uncaughtExceptionMonitor", (error) => {
  workerPort.postMessage({
    type: "error",
    error: error instanceof Error ? error.message : String(error),
  });
});

async function runTick() {
  if (isRunningTick) {
    return;
  }

  isRunningTick = true;

  try {
    const changedEventIds: string[] = [];
    const scoreEventIds = new Set<string>();
    const jobs = (await convex.mutation(references.claimDueScheduledJobs, {
      secret: env.internalSecret,
      limit: RECONCILE_BATCH_SIZE,
    })) as Array<{ id: string; eventId: string }>;

    for (const job of jobs) {
      try {
        const result = (await convex.mutation(references.reconcileStatuses, {
        secret: env.internalSecret,
        eventId: job.eventId as never,
      })) as { changedEventIds: string[]; scoreEventIds: string[] };

        changedEventIds.push(...result.changedEventIds);
        if (!changedEventIds.includes(job.eventId)) changedEventIds.push(job.eventId);
        for (const eventId of result.scoreEventIds) scoreEventIds.add(eventId);
        await convex.mutation(references.completeScheduledJob, { secret: env.internalSecret, jobId: job.id as never });
      } catch {
        await convex.mutation(references.releaseScheduledJob, { secret: env.internalSecret, jobId: job.id as never });
      }
    }

    for (const eventId of scoreEventIds) {
      await convex.mutation(references.applyEventScore, {
        secret: env.internalSecret,
        eventId,
      });
    }

    if (changedEventIds.length > 0) {
      workerPort.postMessage({ type: "eventsChanged", eventIds: changedEventIds });
    }

  } catch (error) {
    workerPort.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isRunningTick = false;
  }
}

void convex.mutation(references.backfillMissingScheduledJobs, { secret: env.internalSecret })
  .then(() => runTick())
  .catch((error) => workerPort.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) }));
setInterval(() => {
  void runTick();
}, RECONCILE_INTERVAL_MS);
