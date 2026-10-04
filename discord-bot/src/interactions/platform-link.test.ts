import assert from "node:assert/strict"
import test from "node:test"

import {
    buildPlatformLinkApplyModalId,
    buildPlatformLinkCustomId,
    buildPlatformLinkModalId,
    buildPlatformLinkSearchModalId,
    getPlatformFlowMessages,
    parsePlatformLinkApplyModalId,
    parsePlatformLinkInteractionId,
    parsePlatformLinkModalId,
    parsePlatformLinkSearchModalId,
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

test("membership player-search IDs retain the wizard draft", () => {
    const context = {
        mode: "membership" as const,
        categoryId: "recruit",
        gameId: "wardogs" as const,
        draftId: "draft-1",
    }

    assert.deepEqual(
        parsePlatformLinkSearchModalId(buildPlatformLinkSearchModalId(context)),
        context
    )
})

test("long membership platform-link IDs remain within Discord's limit", () => {
    const context = {
        mode: "membership" as const,
        categoryId: "membership-0lf7ad1b",
        gameId: "hell_let_loose_vietnam" as const,
        draftId: "vx7f04ge2g8rdgp68kqv81dyr98fm9mw",
    }

    const ids = [
        buildPlatformLinkCustomId("platform", context),
        buildPlatformLinkCustomId("manual", context, "playstation"),
        buildPlatformLinkModalId(context, "playstation"),
        buildPlatformLinkSearchModalId(context),
    ]

    for (const id of ids) {
        assert.ok(id.length <= 100, `${id} exceeds Discord's custom ID limit`)
    }
})

test("Czech platform-flow copy is localized", () => {
    assert.equal(
        getPlatformFlowMessages("cs").startButton,
        "Propojit platform ID"
    )
})
