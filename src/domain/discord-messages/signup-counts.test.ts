import assert from "node:assert/strict"
import test from "node:test"

import {
    countSignups,
    formatGroupCount,
    readSignupGroupLimits,
} from "./signup-counts"

const groups = [
    { id: "inf", name: "Pěchota" },
    { id: "tank", name: "Tanky" },
    { id: "recon", name: "Recon" },
    { id: "arty", name: "Dělostřelectvo" },
]

test("counts sign-ups per offered group with caps, in group order", () => {
    const counts = countSignups({
        groups,
        offeredGroupIds: ["recon", "inf", "tank"],
        signups: [
            ...Array.from({ length: 15 }, () => ({ group: "inf" })),
            ...Array.from({ length: 6 }, () => ({ group: "tank" })),
            { group: "recon" },
            { group: "Recon" },
        ],
        limits: readSignupGroupLimits([
            { groupId: "tank", max: 6 },
            { groupId: "recon", max: 2 },
        ]),
    })

    assert.equal(counts.total, 23)
    assert.equal(counts.withoutGroup, 0)
    assert.deepEqual(counts.groups.map(formatGroupCount), [
        "Pěchota 15",
        "Tanky 6/6",
        "Recon 2/2",
    ])
})

test("sign-ups outside the offered groups count as without group", () => {
    const counts = countSignups({
        groups,
        offeredGroupIds: [],
        signups: [{ group: "GENERAL" }, { group: null }, {}],
    })
    assert.deepEqual(counts, { total: 3, groups: [], withoutGroup: 3 })

    const everyGroup = countSignups({ groups, signups: [{ group: "arty" }] })
    assert.equal(everyGroup.groups.length, 4)
    assert.equal(everyGroup.groups[3]?.count, 1)
})

test("group caps are read defensively", () => {
    assert.deepEqual(
        [
            ...readSignupGroupLimits([
                { groupId: "tank", max: 6 },
                { groupId: " recon ", max: 2 },
                { groupId: "inf", max: 0 },
                { groupId: "arty", max: 2.5 },
                { groupId: "", max: 3 },
                { max: 4 },
                null,
                "tank",
            ]),
        ],
        [
            ["tank", 6],
            ["recon", 2],
        ]
    )
    assert.deepEqual(
        [...readSignupGroupLimits({ tank: 6, inf: "9" })],
        [["tank", 6]]
    )
    for (const value of [undefined, null, 6, "tank:6", true])
        assert.equal(readSignupGroupLimits(value).size, 0)
})
