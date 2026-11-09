import {
    sharedGroupPresentation,
    sharedSignupLimits,
    validateSharedSignupGroups,
} from "./shared-match"
import assert from "node:assert/strict"
import test from "node:test"

test("invitations retain host group IDs, optional ceilings, and distinct groups", () => {
    assert.deepEqual(
        validateSharedSignupGroups(
            [{ groupId: "inf" }, { groupId: "armor", max: 6 }],
            ["inf", "armor"]
        ),
        [{ groupId: "inf" }, { groupId: "armor", max: 6 }]
    )
    for (const groups of [
        [{ groupId: "foreign" }],
        [{ groupId: "inf" }, { groupId: "inf" }],
        [{ groupId: "inf", max: 0 }],
        [{ groupId: "inf", max: 1.5 }],
        [{ groupId: "inf", max: NaN }],
        [{ groupId: "inf", max: 501 }],
    ])
        assert.throws(() => validateSharedSignupGroups(groups, ["inf"]))
})

test("guest caps inherit the host ceiling and may only narrow it", () => {
    const offered = [{ groupId: "inf", max: 10 }, { groupId: "armor" }]
    assert.deepEqual(sharedSignupLimits(offered, ["inf", "armor"], []), [
        { groupId: "inf", max: 10 },
    ])
    assert.deepEqual(
        sharedSignupLimits(
            offered,
            ["inf", "armor"],
            [
                { groupId: "inf", max: 4 },
                { groupId: "armor", max: 20 },
            ]
        ),
        [
            { groupId: "inf", max: 4 },
            { groupId: "armor", max: 20 },
        ]
    )
    assert.throws(
        () =>
            sharedSignupLimits(offered, ["inf"], [{ groupId: "inf", max: 11 }]),
        /exceeds/
    )
    assert.throws(() => sharedSignupLimits(offered, ["foreign"], []), /offered/)
    assert.throws(
        () =>
            sharedSignupLimits(
                offered,
                ["inf"],
                [{ groupId: "armor", max: 4 }]
            ),
        /selected/
    )
    assert.throws(
        () =>
            sharedSignupLimits(
                offered,
                ["inf"],
                [
                    { groupId: "inf", max: 2 },
                    { groupId: "inf", max: 2 },
                ]
            ),
        /distinct/
    )
})

test("foreign group icons drop static and animated custom emoji and roles, preserving color and Unicode", () => {
    for (const discordEmoji of ["<:infantry:12345>", "<a:tanks:12345>"]) {
        const group = {
            discordEmoji,
            discordRoleId: "private-role",
            color: "#00ff00",
        }
        assert.deepEqual(sharedGroupPresentation(group), {
            discordEmoji: undefined,
            discordRoleId: undefined,
            color: "#00ff00",
        })
        assert.equal(group.discordRoleId, "private-role")
    }
    assert.equal(
        sharedGroupPresentation({ discordEmoji: "🛡️" }).discordEmoji,
        "🛡️"
    )
})
