import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { importServerEventsFromLinks } from "@/lib/server-match-results";
import { completeServerTraining, saveServerEvent } from "@/lib/server-events";
import { createServerEventsPostHandler } from "@/lib/api/event-route-handlers";
import { eventSchema } from "@/lib/validation/event";

const postHandler = createServerEventsPostHandler({
  eventSchema,
  saveServerEvent,
  concludeServerEvent: async () => { throw new Error("Unused."); },
  completeServerTraining,
  importServerEventsFromLinks,
  importEventMatchResults: async () => { throw new Error("Unused."); },
  getEventMetadata: async () => null,
  finalizeTrainingCompletion: async () => undefined,
  revalidateCacheEntries,
  appCacheTags,
  logRouteError,
  getUserSafeErrorMessage,
});

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  return postHandler(request, context);
}
