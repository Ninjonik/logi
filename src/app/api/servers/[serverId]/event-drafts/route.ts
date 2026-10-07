import { createEventFlowWriteHandler } from "@/lib/api/event-draft-routes"
import { eventDraftRouteDeps } from "@/lib/api/event-draft-route-deps"

/** Saves or publishes the new-match flow (draft autosave included). */
export const POST = createEventFlowWriteHandler(eventDraftRouteDeps)
