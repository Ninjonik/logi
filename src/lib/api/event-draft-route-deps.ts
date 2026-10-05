import {
    deleteEventDraft,
    publishEventDraft,
    saveEventDraft,
} from "@/lib/gateways/event-drafts"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"
import { logRouteError } from "@/lib/server-route-errors"
import { readBoundedJson } from "@/lib/api/request-json"

/** Runtime wiring of the new-match flow's draft routes. */
export const eventDraftRouteDeps = {
    denied: clanAdminWriteDenied,
    readJson: readBoundedJson,
    saveDraft: saveEventDraft,
    publish: publishEventDraft,
    remove: deleteEventDraft,
    revalidate: (serverId: string, eventId: string) =>
        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.events(serverId),
            appCacheTags.matches(serverId),
            appCacheTags.event(eventId),
            appCacheTags.match(eventId),
        ]),
    logError: logRouteError,
}
