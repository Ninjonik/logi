import assert from "node:assert/strict"
import test from "node:test"

import { createInteractionRegistry } from "../interactions/registry"
import { interactionFeatures } from "../interactions/features"
import { matchAnnouncementInteractions } from "./interactions"

const context = {
    enqueueEventSync: () => undefined,
    triggerPollSoon: () => undefined,
}

test("the announcement's buttons and selects route to the match feature", () => {
    const registry = createInteractionRegistry(
        [matchAnnouncementInteractions],
        context
    )
    assert.deepEqual(registry.routes(), [
        "button:attendees-page:",
        "button:attendees-remind:",
        "button:attendees:",
        "button:check-signup:",
        "button:signup-picker:",
        "button:signup:",
        "stringSelect:attendees-filter:",
        "stringSelect:signup:",
    ])
})

test("the feature is wired into the bot", () => {
    assert.ok(interactionFeatures.includes(matchAnnouncementInteractions))
})
