import { historyRecord } from "../../infrastructure/testing/game-history"
import { handleGameHistoryRead } from "./game-history-route"
import assert from "node:assert/strict"
import test from "node:test"

test("history cursors bind caller, workspace and filters; stale scans return 410", async () => {
    const scope = {
        guildId: "guild-a",
        binding: "key:hash",
        secret: "synthetic-history-secret",
    }
    let calls = 0
    const read = async () => {
        calls++
        return {
            items: [historyRecord()],
            revision: "1",
            nextCursor: "db-position",
            lastCollectedAt: null,
        }
    }
    const request = (
        query = "",
        base = "https://logi.test/api/v1/clan/server-game-history"
    ) => new Request(`${base}?game=wardogs${query}`)
    const response = await handleGameHistoryRead(request(), { ...scope, read })
    const body = await response.json()
    assert.equal(response.headers.get("cache-control"), "no-store")
    const cursor = encodeURIComponent(body.data.nextCursor)
    assert.equal(
        (
            await handleGameHistoryRead(request(`&cursor=${cursor}`), {
                ...scope,
                read,
            })
        ).status,
        200
    )
    const before = calls
    for (const change of [{ binding: "key:other" }, { guildId: "other" }])
        assert.equal(
            (
                await handleGameHistoryRead(request(`&cursor=${cursor}`), {
                    ...scope,
                    ...change,
                    read,
                })
            ).status,
            400
        )
    assert.equal(
        (
            await handleGameHistoryRead(
                request(`&cursor=${cursor}&map=other`),
                { ...scope, read }
            )
        ).status,
        400
    )
    assert.equal(calls, before)
    assert.equal(
        (
            await handleGameHistoryRead(request(`&cursor=${cursor}`), {
                ...scope,
                read: async () => ({ resetRequired: true }),
            })
        ).status,
        410
    )
    assert.equal(
        (
            await handleGameHistoryRead(request(), {
                ...scope,
                read: async () => null,
            })
        ).status,
        403
    )
    assert.equal(
        (
            await handleGameHistoryRead(
                request(
                    "&until=2020-01-01T00:00:00Z&from=2021-01-01T00:00:00Z"
                ),
                { ...scope, read }
            )
        ).status,
        400
    )
    assert.equal(
        (
            await handleGameHistoryRead(request("&id=game-1&map=x"), {
                ...scope,
                read,
            })
        ).status,
        400
    )
    const foreign = historyRecord()
    foreign.guildId = "other"
    assert.equal(
        (
            await handleGameHistoryRead(request(), {
                ...scope,
                read: async () => ({
                    items: [foreign],
                    revision: "1",
                    nextCursor: null,
                    lastCollectedAt: null,
                }),
            })
        ).status,
        503
    )
})
