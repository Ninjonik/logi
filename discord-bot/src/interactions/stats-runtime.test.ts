import {
    createStatsRuntimePorts,
    type StatsRuntimeDependencies,
} from "./stats-runtime"
import type { StatsRequest } from "../../../src/application/game-data/read-player-stats"
import { historyRecord } from "../../../src/infrastructure/testing/game-history"
import assert from "node:assert/strict"
import test from "node:test"

const request: StatsRequest = {
    guildId: "111111111111111111",
    requesterId: "222222222222222222",
    targetId: "222222222222222222",
    game: "wardogs",
    period: "all",
}

test("dense history is bounded by player facts as well as page count", async () => {
    const f = setup(),
        row = historyRecord()
    row.session.players = Array.from({ length: 300 }, (_, n) => ({
        ...row.session.players[0],
        platformId: `synthetic-${n}`,
    }))
    f.dependencies.history = async (_scope, cursor) => {
        const page = Number(cursor ?? 0)
        return {
            items: Array.from({ length: 20 }, (_, n) => ({
                ...row,
                id: `${page}-${n}`,
            })),
            revision: "1",
            nextCursor: page === 4 ? null : String(page + 1),
            lastCollectedAt: null,
        }
    }
    await assert.rejects(
        createStatsRuntimePorts(f.dependencies).history(request),
        /budget/
    )
})
function setup() {
    let time = Date.now(),
        present = true,
        checks = 0,
        reads = 0
    const row = historyRecord()
    const dependencies: StatsRuntimeDependencies = {
        now: () => time,
        member: async () => {
            checks++
            return present
        },
        account: async () => ({
            steamIds: ["76561198199051397"],
            name: "Fixture",
        }),
        link: async () => {},
        history: async () => {
            reads++
            return {
                items: [row],
                revision: row.revision,
                nextCursor: null,
                lastCollectedAt: row.collectedAt,
            }
        },
        hll: async () => ({
            status: "unavailable",
            profile: null,
            fetchedAt: null,
            reason: "blocked",
        }),
        send: async () => {},
        artwork: async () => null,
    }
    return {
        dependencies,
        ports: createStatsRuntimePorts(dependencies),
        leave: () => {
            present = false
        },
        advance: () => {
            time += 6000
        },
        counts: () => ({ checks, reads }),
    }
}
test("stats runtime caches history but forces fresh membership before revealing it", async () => {
    const f = setup()
    assert.equal(await f.ports.authorize(request), true)
    await f.ports.history(request)
    await f.ports.history(request)
    assert.equal(f.counts().reads, 1)
    f.leave()
    assert.equal(await f.ports.authorize(request), false)
    await assert.rejects(f.ports.history(request), /forbidden/)
})
test("long reads renew the actual membership observation and never aggregate mixed revisions", async () => {
    const f = setup(),
        seen: number[] = []
    f.dependencies.history = async (scope, cursor) => {
        seen.push(scope.observedAt)
        if (cursor === null) {
            f.advance()
            return {
                items: [],
                revision: "1",
                nextCursor: "page2",
                lastCollectedAt: null,
            }
        }
        return { resetRequired: true }
    }
    const ports = createStatsRuntimePorts(f.dependencies)
    await assert.rejects(ports.history(request), /revision/)
    assert.ok(seen.length >= 2)
    assert.ok(seen[1] > seen[0])
    assert.ok(f.counts().checks >= 2)
})
test("another member must still belong to the guild and sharing rechecks the requester", async () => {
    const f = setup()
    f.dependencies.member = async (_guild, id) => id === request.requesterId
    const ports = createStatsRuntimePorts(f.dependencies)
    assert.equal(
        await ports.authorize({ ...request, targetId: "333333333333333333" }),
        false
    )
    f.dependencies.member = async () => false
    await assert.rejects(
        ports.share(request, "444444444444444444", {
            embeds: [],
            allowedMentions: { parse: [] },
        }),
        /forbidden/
    )
})
