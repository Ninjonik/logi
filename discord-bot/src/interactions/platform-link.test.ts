import assert from "node:assert/strict"
import test from "node:test"

import {
    buildPlatformLinkApplyModalId,
    buildPlatformLinkCustomId,
    buildPlatformLinkModalId,
    parsePlatformLinkApplyModalId,
    parsePlatformLinkInteractionId,
    parsePlatformLinkModalId,
} from "./platform-link"

test("Wardogs membership platform-link IDs preserve the game scope", () => {
    const context = {
        mode: "membership" as const,
        categoryId: "recruit",
        gameId: "wardogs" as const,
    }

    assert.deepEqual(
        parsePlatformLinkInteractionId(
            buildPlatformLinkCustomId("manual", context, "steam")
        ),
        { step: "manual", context, extra: "steam" }
    )
    assert.deepEqual(
        parsePlatformLinkModalId(buildPlatformLinkModalId(context, "steam")),
        { context, platform: "steam" }
    )
    assert.deepEqual(
        parsePlatformLinkApplyModalId(
            buildPlatformLinkApplyModalId("recruit", "steam", "wardogs")
        ),
        { categoryId: "recruit", gameId: "wardogs", platform: "steam" }
    )
})

test("legacy HLL platform-link IDs remain readable", () => {
    assert.deepEqual(
        parsePlatformLinkInteractionId("plink:manual:membership:recruit:steam"),
        {
            step: "manual",
            context: { mode: "membership", categoryId: "recruit" },
            extra: "steam",
        }
    )
})
