import { completeOnboardingMilestone } from "./progress"
import assert from "node:assert/strict"
import test from "node:test"

test("player import completion survives independently of other tours and clans", () => {
    const original = {
        dashboardSetupCompletedAt: "welcome",
        workspaceTourCompletedAt: { clan: "tour" },
        playerImportsCompletedAt: { other: "earlier" },
    }
    const completed = completeOnboardingMilestone(
        original,
        "player_import",
        "clan",
        "now"
    )
    assert.deepEqual(completed, {
        ...original,
        playerImportsCompletedAt: { other: "earlier", clan: "now" },
    })
    assert.deepEqual(original.playerImportsCompletedAt, { other: "earlier" })
    assert.throws(
        () =>
            completeOnboardingMilestone(
                original,
                "player_import",
                undefined,
                "now"
            ),
        /workspace/
    )
    assert.deepEqual(
        completeOnboardingMilestone(
            completed,
            "workspace_tour",
            "clan",
            "later"
        ).playerImportsCompletedAt,
        completed.playerImportsCompletedAt
    )
})
