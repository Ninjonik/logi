import { parentPort } from "node:worker_threads";

import {
  buildEventSignatureMap,
  getChangedEventIds,
} from "../../../src/application/discord-sync/payload-builder";
import { convex, references } from "../convex";
import { env } from "../environment";

const EVENT_INDEX_POLL_INTERVAL_MS = 2_000;
const RECONCILE_INTERVAL_MS = 300_000;
const FULL_RESYNC_EVERY_TICKS = 5;
const RECONCILE_BATCH_SIZE = 25;
const SCORE_BATCH_SIZE = 1;

if (!parentPort) {
  throw new Error("Fallback worker must be started from a worker thread.");
}

const workerPort = parentPort;

let tickCount = 0;
let previousEventSignatures = new Map<string, string>();
let eventIndexLoaded = false;
let reconcileCursor: string | null = null;
const pendingScoreEventIds: string[] = [];

function enqueueScoreEventIds(eventIds: string[]) {
  for (const eventId of eventIds) {
    if (!pendingScoreEventIds.includes(eventId)) {
      pendingScoreEventIds.push(eventId);
    }
  }
}

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
    const result = (await convex.mutation(references.reconcileStatuses, {
      secret: env.internalSecret,
      cursor: reconcileCursor ?? undefined,
      limit: RECONCILE_BATCH_SIZE,
    })) as { changedEventIds: string[]; scoreEventIds: string[]; continueCursor: string | null; isDone: boolean };

    reconcileCursor = result.isDone ? null : result.continueCursor;
    enqueueScoreEventIds(result.scoreEventIds);

    for (let index = 0; index < SCORE_BATCH_SIZE && pendingScoreEventIds.length > 0; index += 1) {
      const eventId = pendingScoreEventIds.shift();
      if (!eventId) {
        break;
      }

      await convex.mutation(references.applyEventScore, {
        secret: env.internalSecret,
        eventId,
      });
    }

    if (result.changedEventIds.length > 0) {
      workerPort.postMessage({ type: "eventsChanged", eventIds: result.changedEventIds });
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

async function pollEventIndex() {
  try {
    const index = (await convex.query(references.listEventSyncIndex, {
      secret: env.internalSecret,
    })) as {
      events: Array<{ id: string; updatedAt: string }>;
      rosters: Array<{ eventId: string; updatedAt: string }>;
    };
    const { signatures } = buildEventSignatureMap(index);

    if (!eventIndexLoaded) {
      previousEventSignatures = signatures;
      eventIndexLoaded = true;
      return;
    }

    const changedEventIds = getChangedEventIds(signatures, previousEventSignatures, false);
    previousEventSignatures = signatures;

    if (changedEventIds.length > 0) {
      workerPort.postMessage({ type: "eventsChanged", eventIds: changedEventIds });
    }
  } catch (error) {
    workerPort.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

void pollEventIndex();
setInterval(() => {
  void pollEventIndex();
}, EVENT_INDEX_POLL_INTERVAL_MS);

void runTick();
setInterval(() => {
  void runTick();
}, RECONCILE_INTERVAL_MS);
