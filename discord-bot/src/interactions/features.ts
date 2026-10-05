import { matchAnnouncementInteractions } from "../events/interactions"
import type { InteractionFeature } from "./registry"

/**
 * Feature modules that route their own interactions through the registry
 * (`registry.ts`). Append one line per feature, e.g. `seedInteractions`;
 * the dispatch in `interactions.ts` stays untouched. Routes registered here
 * take precedence; anything else falls through to the existing dispatch.
 */
export const interactionFeatures: readonly InteractionFeature[] = [
    matchAnnouncementInteractions,
]
