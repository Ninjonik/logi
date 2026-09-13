import assert from "node:assert/strict"
import test from "node:test"

import {
    normalizeSteamBanInfo,
    normalizeSteamProfileUrl,
} from "./server-match-results"

test("normalizes Valkyria's Steam ban summary object for Convex storage", () => {
    assert.deepEqual(
        normalizeSteamBanInfo({
            bans: {
                CommunityBanned: false,
                DaysSinceLastBan: 0,
                EconomyBan: "none",
                NumberOfGameBans: 0,
                NumberOfVACBans: 0,
                SteamId: "76561199107218738",
                VACBanned: false,
            },
        }),
        { bans: 0, has_bans: false }
    )
})

test("retains legacy numeric Steam ban counts", () => {
    assert.deepEqual(normalizeSteamBanInfo({ bans: 2, has_bans: true }), {
        bans: 2,
        has_bans: true,
    })
})

test("extracts the profile URL from Valkyria's Steam profile object", () => {
    assert.equal(
        normalizeSteamProfileUrl({
            avatar: "https://avatars.steamstatic.com/avatar.jpg",
            personaname: "VLKㆍRyhar67",
            profileurl:
                "https://steamcommunity.com/profiles/76561199107218738/",
            steamid: "76561199107218738",
        }),
        "https://steamcommunity.com/profiles/76561199107218738/"
    )
})

test("retains legacy profile URLs", () => {
    assert.equal(
        normalizeSteamProfileUrl("https://steamcommunity.com/id/example/"),
        "https://steamcommunity.com/id/example/"
    )
})
