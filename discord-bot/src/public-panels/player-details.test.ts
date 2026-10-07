import { loadPlayerDetails, playerControl } from "./player-details"
import assert from "node:assert/strict"
import test from "node:test"

const panel = {
    _id: "panel",
    guildId: "guild",
    channelId: "current",
    revision: 2,
    enabled: true,
    showPlayers: true,
    kind: "server",
}
function setup() {
    let reads = 0
    let checks = 0
    const input = {
        guildId: "guild",
        channelId: "current",
        customId: playerControl("panel", 2, 1, "next"),
    }
    const ports = {
        readPanel: async () => panel,
        readLive: async () => {
            reads++
            return { marker: "current private data" }
        },
        canView: async () => {
            checks++
            return true
        },
    }
    return { input, ports, reads: () => reads, checks: () => checks }
}
test("current player control checks access before reading and before returning", async () => {
    const f = setup()
    const result = await loadPlayerDetails(f.input, f.ports)
    assert.equal(result?.page, 1)
    assert.equal(result?.data.marker, "current private data")
    assert.equal(f.reads(), 1)
    assert.equal(f.checks(), 2)
})
test("retained ephemeral control from the old channel performs no live read", async () => {
    const f = setup()
    f.input.channelId = "old"
    assert.equal(await loadPlayerDetails(f.input, f.ports), null)
    assert.equal(f.reads(), 0)
})
test("old configuration and unversioned controls are invalidated before data access", async () => {
    for (const customId of [
        playerControl("panel", 1, 0, "open"),
        "logi:players:panel:0",
        "logi:players:panel:NaN:0:open",
    ]) {
        const f = setup()
        f.input.customId = customId
        assert.equal(await loadPlayerDetails(f.input, f.ports), null)
        assert.equal(f.reads(), 0)
    }
})
test("revoked channel membership blocks a retained private control", async () => {
    const f = setup()
    f.ports.canView = async () => false
    assert.equal(await loadPlayerDetails(f.input, f.ports), null)
    assert.equal(f.reads(), 0)
})
test("configuration change or permission loss while fetching withholds the reply", async () => {
    for (const revoke of ["revision", "permission"] as const) {
        const f = setup()
        let calls = 0
        if (revoke === "revision")
            f.ports.readPanel = async () => ({
                ...panel,
                revision: ++calls === 1 ? 2 : 3,
            })
        else f.ports.canView = async () => ++calls === 1
        assert.equal(await loadPlayerDetails(f.input, f.ports), null)
        assert.equal(f.reads(), 1)
    }
})
test("wrong guild and disabled player details never reach the provider", async () => {
    for (const replacement of [
        { ...panel, guildId: "other" },
        { ...panel, enabled: false },
        { ...panel, showPlayers: false },
        { ...panel, kind: "results" },
    ]) {
        const f = setup()
        f.ports.readPanel = async () => replacement
        assert.equal(await loadPlayerDetails(f.input, f.ports), null)
        assert.equal(f.reads(), 0)
    }
})
test("a paused, unsent or removed panel answers no player list", async () => {
    for (const change of [
        { paused: true },
        { enabled: false },
        { draft: true },
        { removing: true },
        { kind: "servers" },
        { showPlayers: false },
    ]) {
        const f = setup()
        f.ports.readPanel = async () => ({ ...panel, ...change })
        assert.equal(await loadPlayerDetails(f.input, f.ports), null)
        assert.equal(f.reads(), 0)
    }
})
test("legacy scoreboard panels keep their player list", async () => {
    const f = setup()
    f.ports.readPanel = async () => ({ ...panel, kind: "scoreboard" })
    assert.ok(await loadPlayerDetails(f.input, f.ports))
})
