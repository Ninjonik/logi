import {
    warconLive,
    warconServerId,
    warconTime,
} from "../../infrastructure/testing/warcon"
import { serveWarconRead, type WarconReadPorts } from "./read-warcon"
import { ProviderError } from "../../domain/game-data/contracts"
import assert from "node:assert/strict"
import { test } from "node:test"
const now = () => Date.parse(warconTime)
function fixture() {
    let fetched = 0,
        finished = 0,
        allowed = true
    const ports: WarconReadPorts = {
        now,
        prepare: async () => ({
            kind: "claimed",
            claim: { cacheId: "cache", generation: 1, fence: 1 },
            source: {
                ref: "wd",
                guildId: "guild",
                gameId: "wardogs",
                provider: "wardogs_warcon",
                providerServerId: warconServerId,
                origin: "https://warcon.example",
                secretRef: "LOGI_GAME_DATA_WD_TOKEN",
                allowedAddresses: [],
                credentialMode: "legacy_env",
                managed: "operator",
                usable: true,
            },
        }),
        read: async () => {
            fetched++
            return {
                view: "live",
                data: {
                    ...warconLive(),
                    freshness: "fresh",
                    playersFreshness: "fresh",
                },
            }
        },
        finish: async () => {
            finished++
            return allowed
        },
    }
    return {
        ports,
        fetched: () => fetched,
        finished: () => finished,
        deny: () => {
            allowed = false
        },
    }
}
test("shared cache avoids the provider and live freshness is recalculated at response time", async () => {
    const f = fixture()
    f.ports.prepare = async () => ({
        kind: "cached",
        envelope: {
            connectionId: "connection",
            gameId: "wardogs",
            provider: "wardogs_warcon",
            fetchedAt: warconTime,
            cacheUntil: "2026-10-02T12:00:10.000Z",
            result: {
                view: "live",
                data: {
                    ...warconLive(),
                    playersAt: "2026-10-02T11:59:14.000Z",
                    freshness: "fresh",
                    playersFreshness: "fresh",
                },
            },
        },
    })
    const result = await serveWarconRead(
        "connection",
        { view: "live" },
        f.ports
    )
    assert.equal(result.kind, "ready")
    if (result.kind !== "ready" || result.envelope.result.view !== "live")
        return
    assert.equal(result.envelope.result.data.playersFreshness, "stale")
    assert.equal(f.fetched(), 0)
})
test("denied and leased reads do not call the provider", async () => {
    for (const prepared of [
        { kind: "denied" } as const,
        { kind: "busy", retryAfterMs: 1000 } as const,
    ]) {
        const f = fixture()
        f.ports.prepare = async () => prepared
        assert.deepEqual(
            await serveWarconRead("connection", { view: "live" }, f.ports),
            prepared
        )
        assert.equal(f.fetched(), 0)
    }
})
test("an in-flight success cannot escape revocation or a changed connection generation", async () => {
    const f = fixture()
    f.deny()
    const result = await serveWarconRead(
        "connection",
        { view: "live" },
        f.ports
    )
    assert.deepEqual(result, { kind: "denied" })
    assert.equal(f.finished(), 1)
})
test("provider rate limits and failures release the claim with no raw error or stale success", async () => {
    const f = fixture()
    f.ports.read = async () => {
        throw new ProviderError("rate_limited", 90_000)
    }
    let error: string | undefined
    f.ports.finish = async (_claim, value) => {
        error = value.errorCategory
        assert.equal(value.retryAfterMs, 90_000)
        return true
    }
    assert.deepEqual(
        await serveWarconRead("connection", { view: "live" }, f.ports),
        { kind: "failed", errorCategory: "rate_limited", retryAfterMs: 90_000 }
    )
    assert.equal(error, "rate_limited")
})
