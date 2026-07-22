import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { concludeServerEvent, saveServerEvent } from "@/lib/server-events";
import { importEventMatchResults } from "@/lib/server-match-results";
import { createServerEventPatchHandler, createServerEventPostHandler } from "@/lib/api/event-route-handlers";
import { eventSchema } from "@/lib/validation/event";
import { getEventMetadata } from "@/lib/server-metadata";

export const PATCH = createServerEventPatchHandler({
  eventSchema,
  saveServerEvent,
  concludeServerEvent,
  importServerEventsFromLinks: async () => { throw new Error("Unused."); },
  importEventMatchResults,
  getEventMetadata,
  revalidateCacheEntries,
  appCacheTags,
  logRouteError,
  getUserSafeErrorMessage,
});

export const POST = createServerEventPostHandler({
  eventSchema,
  saveServerEvent,
  concludeServerEvent,
  importServerEventsFromLinks: async () => { throw new Error("Unused."); },
  importEventMatchResults,
  getEventMetadata,
  revalidateCacheEntries,
  appCacheTags,
  logRouteError,
  getUserSafeErrorMessage,
});
