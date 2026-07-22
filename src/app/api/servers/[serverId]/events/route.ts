import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { importServerEventsFromLinks } from "@/lib/server-match-results";
import { saveServerEvent } from "@/lib/server-events";
import { createServerEventsPostHandler } from "@/lib/api/event-route-handlers";
import { eventSchema } from "@/lib/validation/event";

export const POST = createServerEventsPostHandler({
  eventSchema,
  saveServerEvent,
  concludeServerEvent: async () => { throw new Error("Unused."); },
  importServerEventsFromLinks,
  importEventMatchResults: async () => { throw new Error("Unused."); },
  getEventMetadata: async () => null,
  revalidateCacheEntries,
  appCacheTags,
  logRouteError,
  getUserSafeErrorMessage,
});
