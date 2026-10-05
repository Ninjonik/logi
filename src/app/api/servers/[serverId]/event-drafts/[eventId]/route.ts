import { createEventDraftDeleteHandler } from "@/lib/api/event-draft-routes"
import { eventDraftRouteDeps } from "@/lib/api/event-draft-route-deps"

/** Discards a match draft; published events are never deleted here. */
export const DELETE = createEventDraftDeleteHandler(eventDraftRouteDeps)
