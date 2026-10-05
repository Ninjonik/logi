import { matchAnnouncementInteractions } from "../events/interactions"
import { attendanceReplyInteractions } from "./attendance-replies"
import { matchRecapInteractions } from "./match-recap-preference"
import { rosterInteractions } from "./roster-assignment"
import { commandFeatures } from "../commands/features"
import type { InteractionFeature } from "./registry"

/**
 * Feature modules that route their own interactions through the registry
 * (`registry.ts`). Append one line per feature, e.g. `seedInteractions`;
 * the dispatch in `interactions.ts` stays untouched. Routes registered here
 * take precedence; anything else falls through to the existing dispatch.
 */
export const interactionFeatures: readonly InteractionFeature[] = [
    // /help, /stats, /player, /notice, /server-status (commands workstream).
    ...commandFeatures,
    // Announcement buttons, the group picker and "Zobrazit přihlášené".
    matchAnnouncementInteractions,
    rosterInteractions,
    attendanceReplyInteractions,
    matchRecapInteractions,
]
