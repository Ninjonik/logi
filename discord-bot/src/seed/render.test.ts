import assert from "node:assert/strict"
import test from "node:test"

import { seedMapFacts as domainSeedMapFacts } from "../../../src/domain/discord-seed/map"
import { boardSeedSettings } from "../../../src/infrastructure/testing/in-memory-seed"
import type { StoredSeedRun } from "../../../src/application/discord-seed/ports"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { seedCallMessage, seedControlMessage, seedMapFacts } from "./render"
import type { SeedDeliveryServer } from "../../../convex/discordSeedBot"
import { startSeedRun } from "../../../src/domain/discord-seed/run"

const NOW = Date.parse("2026-10-06T11:00:00Z")
const CONTEXT = {
    language: "cs",
    timeZone: "Europe/Prague",
    clanName: "Vlci",
    messageStyle: null,
    siteUrl: "https://logi.app",
}

function snapshot(map: string | null): ServerSnapshot {
    return {
        observedAt: new Date(NOW - 40_000).toISOString(),
        providerUpdatedAt: null,
        displayName: "Vlci #1 · Public",
        state: "online",
        map,
        players: 12,
        capacity: 100,
        providerInstanceId: null,
        scores: [],
        capabilities: ["server_snapshot"],
        id: "gameDataConnections:vlci1",
        guildId: "100000000000000000",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        freshness: "fresh",
        lastSuccessAt: new Date(NOW - 40_000).toISOString(),
        attribution: null,
    }
}

function server(map: string | null): SeedDeliveryServer {
    return {
        connectionId: "gameDataConnections:vlci1",
        settings: boardSeedSettings(),
        revision: 1,
        name: "Vlci #1 · Public",
        gameId: "hell_let_loose",
        reading: null,
        snapshot: snapshot(map),
        status: "below_start",
        activeRun: null,
        joinUrl: "https://logi.app/join/vlci-1",
        panel: null,
        control: { outbox: null, message: null },
    }
}

const run: StoredSeedRun = {
    ...startSeedRun({
        trigger: {
            kind: "manual",
            actor: { id: "100000000000000001", name: "Hráč 01" },
            via: "web",
            channelId: null,
        },
        now: NOW - 60_000,
        plan: { liveFrom: 40, maxDurationMinutes: 120, endAction: "edit" },
        ping: { kind: "silent", reason: "no_role" },
        observation: {
            players: 12,
            capacity: 100,
            map: "Foy",
            observedAt: NOW - 60_000,
        },
    }),
    guildId: "100000000000000000",
    connectionId: "gameDataConnections:vlci1",
    planId: "plan-1",
    channelId: "111111111111111111",
    requestKey: null,
    serverName: "Vlci #1 · Public",
    id: "run-1",
}

test("the call carries the map line and picture of the shared rule the P3 preview uses", () => {
    const { view } = seedCallMessage(
        run,
        server("foy_warfare_day"),
        CONTEXT,
        NOW
    )
    const shared = domainSeedMapFacts(
        { gameId: "hell_let_loose", map: "foy_warfare_day" },
        "cs",
        CONTEXT.siteUrl
    )
    assert.deepEqual(view.header?.thumbnail, {
        url: "https://logi.app/maps/foy.webp",
        description: "Foy",
    })
    assert.deepEqual(view.header?.thumbnail, shared.thumbnail)
    assert.match(JSON.stringify(view.blocks), /"Foy · Warfare · Den · /)
    assert.deepEqual(
        seedMapFacts(snapshot("foy_warfare_day"), "cs", CONTEXT.siteUrl),
        shared
    )
})

test("the control message names the catalogue map; no snapshot shows no map", () => {
    const control = seedControlMessage(server("foy_warfare_day"), CONTEXT)
    assert.match(control.header?.status ?? "", /Foy/)
    assert.doesNotMatch(control.header?.status ?? "", /foy_warfare_day/)
    assert.deepEqual(seedMapFacts(null, "cs", CONTEXT.siteUrl), {
        mapLine: null,
        mapName: null,
        thumbnail: null,
    })
})
