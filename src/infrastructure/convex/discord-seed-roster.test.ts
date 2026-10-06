import assert from "node:assert/strict"
import test from "node:test"

import { seedPlayerCounts } from "../../../convex/discordSeedStore"
import { hllLiveFixture, hllLiveTime } from "../testing/hll-live"
import { testContext } from "./testing/database"

const GUILD = "100000000000000099"
const SERVER = { guildId: GUILD, connectionId: "gameDataConnections:hll" }
const AT = Date.parse(hllLiveTime)

type Reader = Parameters<typeof seedPlayerCounts>[0]

function seeded(generation = 1): Reader {
    const ctx = testContext()
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:hll",
        guildId: GUILD,
        sourceRef: "hll",
        sourceFingerprint: "{}",
        generation: 1,
        enabled: true,
        provider: "hll_crcon",
        gameId: "hell_let_loose",
    })
    ctx.db.seed("hllLiveCache", {
        _id: "hllLiveCache:hll",
        connectionId: "gameDataConnections:hll",
        generation,
        fence: 1,
        leaseUntil: 0,
        nextAt: AT,
        retainUntil: AT + 3_600_000,
        dataJson: JSON.stringify(hllLiveFixture()),
    })
    // The in-memory database answers the queries the adapter makes.
    return ctx as unknown as Reader
}

test("distinct seeders read the named players of the panel's fresh HLL live read (P5-B04)", async () => {
    const roster = await seedPlayerCounts(seeded(), () => AT + 60_000).roster(
        SERVER
    )
    assert.deepEqual(roster, {
        ids: ["76561198000000001", "76561198000000002"],
        observedAt: AT,
    })
    // Too old, another source generation, another clan: no names, the
    // growth stands in.
    assert.equal(
        await seedPlayerCounts(seeded(), () => AT + 10 * 60_000).roster(SERVER),
        null
    )
    assert.equal(
        await seedPlayerCounts(seeded(2), () => AT).roster(SERVER),
        null
    )
    assert.equal(
        await seedPlayerCounts(seeded(), () => AT).roster({
            ...SERVER,
            guildId: "200000000000000099",
        }),
        null
    )
})
