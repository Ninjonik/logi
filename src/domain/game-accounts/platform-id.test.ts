import assert from "node:assert/strict"
import test from "node:test"

import {
    accountsUsedByApplication,
    parseGameAccountId,
    readStoredGameAccount,
    sameGameAccount,
} from "./platform-id"

test("Steam64 is 17 digits starting 7656119, also from a profile link (M3-B08, L4-B07)", () => {
    assert.deepEqual(parseGameAccountId("steam", " 76561198000000017 "), {
        ok: true,
        platform: "steam",
        id: "76561198000000017",
        stored: "steam:76561198000000017",
    })
    assert.equal(
        parseGameAccountId(
            "steam",
            "https://steamcommunity.com/profiles/76561198000000017/"
        ).ok,
        true
    )
    assert.equal(
        parseGameAccountId("steam", "steam:76561198000000017").ok,
        true
    )
    for (const bad of [
        "7656119800000001",
        "765611980000000177",
        "86561198000000017",
        "Hráč 17",
        "https://steamcommunity.com/id/hrac17",
        "https://evil.example/profiles/76561198000000017",
        "",
    ])
        assert.equal(parseGameAccountId("steam", bad).ok, false, bad)
})

test("Epic, Xbox and PlayStation IDs are checked per platform", () => {
    assert.deepEqual(
        parseGameAccountId("epic", "8F3C2E1D0A9B8C7D6E5F4A3B2C1D0E9F"),
        {
            ok: true,
            platform: "epic",
            id: "8f3c2e1d0a9b8c7d6e5f4a3b2c1d0e9f",
            stored: "epic:8f3c2e1d0a9b8c7d6e5f4a3b2c1d0e9f",
        }
    )
    assert.equal(parseGameAccountId("epic", "Hrac17").ok, false)
    assert.equal(parseGameAccountId("xbox", "Hrac17CZ").ok, true)
    assert.equal(parseGameAccountId("xbox", "Hrac 17#1234").ok, true)
    assert.equal(parseGameAccountId("xbox", "2535412345678901").ok, true)
    assert.equal(parseGameAccountId("xbox", "17Hrac").ok, false)
    assert.equal(parseGameAccountId("xbox", "Hrac  17").ok, false)
    assert.equal(parseGameAccountId("xbox", "a".repeat(16)).ok, false)
    assert.equal(parseGameAccountId("playstation", "Hrac17_CZ").ok, true)
    assert.equal(parseGameAccountId("playstation", "ab").ok, false)
    assert.equal(parseGameAccountId("playstation", "Hrac 17").ok, false)
})

test("stored IDs read back with their platform, old unprefixed ones too", () => {
    assert.deepEqual(readStoredGameAccount("xbox:Hrac17CZ"), {
        stored: "xbox:Hrac17CZ",
        platform: "xbox",
        id: "Hrac17CZ",
    })
    assert.equal(readStoredGameAccount("psn:Hrac").platform, "playstation")
    assert.equal(readStoredGameAccount("76561198000000017").platform, "steam")
    assert.equal(readStoredGameAccount("someone").platform, "other")
    assert.ok(sameGameAccount("xbox:Hrac17CZ", "xbl:hrac17cz"))
    assert.ok(!sameGameAccount("xbox:Hrac17CZ", "steam:76561198000000017"))
})

test("an open application uses the accounts it names, else every linked one (L4-B09)", () => {
    const linked = ["steam:76561198000000017", "xbox:Hrac17CZ"]
    assert.deepEqual([...accountsUsedByApplication(linked, null)], [])
    assert.deepEqual(
        [
            ...accountsUsedByApplication(linked, {
                answers: [{ value: "Steam 76561198000000017" }],
            }),
        ],
        ["steam:76561198000000017"]
    )
    assert.deepEqual(
        [...accountsUsedByApplication(linked, { answers: [{ value: "10" }] })],
        linked
    )
    // An application in windows names its accounts: only those are used,
    // and none when it gave other accounts than the linked ones.
    assert.deepEqual(
        [
            ...accountsUsedByApplication(linked, {
                answers: [{ value: "10" }],
                accounts: ["steam:76561198000000017"],
            }),
        ],
        ["steam:76561198000000017"]
    )
    assert.deepEqual(
        [
            ...accountsUsedByApplication(linked, {
                answers: [],
                accounts: ["xbox:SomeoneElse"],
            }),
        ],
        []
    )
})
