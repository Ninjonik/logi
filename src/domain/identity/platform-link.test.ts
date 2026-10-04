import {
    assertLinkChallenge,
    isActiveVerifiedLink,
    steamCallbackUrl,
} from "./platform-link"
import assert from "node:assert/strict"
import test from "node:test"

test("claimed ID is not proof and unlink invalidates future attribution", () => {
    assert.equal(
        isActiveVerifiedLink({ platformIds: ["76561198000000001"] }),
        false
    )
    const link = {
        platform: "steam",
        platformId: "76561198000000001",
        logiUserId: "player",
        method: "steam_openid",
        verifiedAt: 100,
        revokedAt: null,
    }
    assert.equal(isActiveVerifiedLink(link), true)
    assert.equal(isActiveVerifiedLink({ ...link, revokedAt: 200 }), false)
})

test("expired or reused challenge rejected; other session cannot complete link", () => {
    const actor = { discordUserId: "discord", sessionHash: "session" }
    const challenge = { ...actor, status: "pending" as const, expiresAt: 1000 }
    assert.doesNotThrow(() =>
        assertLinkChallenge(challenge, actor, 999, "pending")
    )
    assert.throws(() => assertLinkChallenge(challenge, actor, 1000, "pending"))
    assert.throws(() =>
        assertLinkChallenge(
            { ...challenge, status: "consumed" },
            actor,
            999,
            "pending"
        )
    )
    assert.throws(() =>
        assertLinkChallenge(
            challenge,
            { ...actor, sessionHash: "other" },
            999,
            "pending"
        )
    )
    assert.throws(() =>
        assertLinkChallenge(
            challenge,
            { ...actor, discordUserId: "other" },
            999,
            "pending"
        )
    )
})

test("callback origin is canonical, never arbitrary user-provided return paths", () => {
    assert.equal(
        steamCallbackUrl("https://logi.test", "state"),
        "https://logi.test/api/platform-links/steam/callback?state=state"
    )
    for (const value of [
        "http://logi.test",
        "https://evil@logi.test",
        "https://logi.test/path",
        "https://logi.test?x=1",
    ]) {
        assert.throws(() => steamCallbackUrl(value, "state"))
    }
})
