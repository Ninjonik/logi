import { validateSignupPreferences } from "./signup-preferences"
import assert from "node:assert/strict"
import test from "node:test"

const input = {
    group: "Infantry",
    kind: "match" as const,
    enabled: true,
    offeredNames: ["Infantry", "Armor"],
}
test("one group remains valid without ranked signup; multiple choices require the opt-in", () => {
    assert.equal(
        validateSignupPreferences({ ...input, preferences: undefined }),
        undefined
    )
    assert.deepEqual(
        validateSignupPreferences({
            ...input,
            enabled: false,
            preferences: ["Infantry"],
        }),
        ["Infantry"]
    )
    assert.deepEqual(
        validateSignupPreferences({
            ...input,
            preferences: [" Infantry ", "Armor"],
        }),
        ["Infantry", "Armor"]
    )
    assert.throws(() =>
        validateSignupPreferences({
            ...input,
            enabled: false,
            preferences: ["Infantry", "Armor"],
        })
    )
    assert.throws(() =>
        validateSignupPreferences({
            ...input,
            kind: "training",
            preferences: ["Infantry", "Armor"],
        })
    )
})
test("rejects duplicates, unknown groups, wrong first choice and empty lists", () => {
    for (const preferences of [
        [],
        ["Infantry", "Infantry"],
        ["Armor", "Infantry"],
        ["Infantry", "Foreign group"],
    ])
        assert.throws(() =>
            validateSignupPreferences({ ...input, preferences })
        )
})
