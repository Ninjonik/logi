import { parentPort } from "node:worker_threads";

import { convex, references } from "../convex";
import { env } from "../environment";

const RECONCILE_INTERVAL_MS = 60_000;
const FULL_RESYNC_EVERY_TICKS = 5;

if (!parentPort) {
  throw new Error("Fallback worker must be started from a worker thread.");
}

const workerPort = parentPort;

let tickCount = 0;

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
  try {
    const changedEventIds = (await convex.mutation(references.reconcileStatuses, {
      secret: env.internalSecret,
    })) as string[];

    if (changedEventIds.length > 0) {
      workerPort.postMessage({ type: "eventsChanged", eventIds: changedEventIds });
    }

    tickCount += 1;
    if (tickCount % FULL_RESYNC_EVERY_TICKS === 0) {
      workerPort.postMessage({ type: "fullResync" });
    }
  } catch (error) {
    workerPort.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

void runTick();
setInterval(() => {
  void runTick();
}, RECONCILE_INTERVAL_MS);
