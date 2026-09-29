import {
    beginSteamLink,
    verifySteamLink,
    type PlatformLinkPorts,
} from "./verify-platform-link"
import assert from "node:assert/strict"
import test from "node:test"

const actor = { discordUserId: "discord", sessionHash: "session" }
function fixture() {
    const calls: string[] = []
    const challenge = {
        ...actor,
        id: "challenge",
        returnOrigin: "https://logi.test",
        locale: "cs" as const,
        expiresAt: 1000,
        status: "verifying" as const,
    }
    const link = {
        platform: "steam" as const,
        platformId: "76561198000000001",
        logiUserId: "player",
        method: "steam_openid" as const,
        verifiedAt: 100,
        revokedAt: null,
    }
    const ports: PlatformLinkPorts = {
        now: () => 100,
        randomState: () => "a".repeat(43),
        hash: (s) => `hash:${s}`,
        create: async () => {
            calls.push("create")
        },
        claim: async () => {
            calls.push("claim")
            return challenge
        },
        verify: async (_params, expected) => {
            calls.push("verify")
            assert.equal(
                expected,
                `https://logi.test/api/platform-links/steam/callback?state=${"a".repeat(43)}`
            )
            return { platformId: link.platformId, nonce: "nonce" }
        },
        complete: async () => {
            calls.push("complete")
            return link
        },
        fail: async () => {
            calls.push("fail")
        },
        redirect: (url) =>
            `https://steamcommunity.com/openid/login?return=${encodeURIComponent(url)}`,
    }
    return { ports, calls, challenge, link }
}
test("begin persists challenge before redirect; verify consumes before contacting Steam", async () => {
    const { ports, calls, link } = fixture()
    assert.match(
        (await beginSteamLink(actor, "https://logi.test", ports, "cs"))
            .redirectUrl,
        /^https:\/\/steamcommunity.com\//
    )
    assert.deepEqual(calls, ["create"])
    const params = new URLSearchParams({ state: "a".repeat(43) })
    assert.deepEqual((await verifySteamLink(params, actor, ports)).link, link)
    assert.deepEqual(calls, ["create", "claim", "verify", "complete"])
})
test("provider failure never completes a link and consumes the attempted challenge", async () => {
    const { ports, calls } = fixture()
    ports.verify = async () => {
        throw new Error("private provider response")
    }
    await assert.rejects(
        verifySteamLink(
            new URLSearchParams({ state: "a".repeat(43) }),
            actor,
            ports
        ),
        /Steam verification failed/
    )
    assert.deepEqual(calls, ["claim", "fail"])
})
test("wrong session or expiry blocks provider and completion", async () => {
    for (const change of [{ sessionHash: "other" }, { expiresAt: 100 }]) {
        const { ports, calls, challenge } = fixture()
        Object.assign(challenge, change)
        await assert.rejects(
            verifySteamLink(
                new URLSearchParams({ state: "a".repeat(43) }),
                actor,
                ports
            )
        )
        assert.deepEqual(calls, ["claim", "fail"])
    }
})
