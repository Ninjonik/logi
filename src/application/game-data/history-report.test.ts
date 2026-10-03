import { historyRecord } from "../../infrastructure/testing/game-history"
import { buildHistoryReport } from "./history-report"
import assert from "node:assert/strict"
import test from "node:test"

test("full report consumes empty continuation pages; revision drift and loops fail closed", async () => {
    const read = async (cursor: string | null) => ({
        items: cursor ? [historyRecord()] : [],
        revision: "1",
        nextCursor: cursor ? null : "next",
        lastCollectedAt: null,
    })
    assert.equal((await buildHistoryReport(read)).report.games, 1)
    await assert.rejects(
        buildHistoryReport(async (cursor) => ({
            ...(await read(cursor)),
            revision: cursor ? "2" : "1",
        })),
        /revision/
    )
    await assert.rejects(
        buildHistoryReport(async () => ({
            ...(await read(null)),
            nextCursor: "again",
        })),
        /cursor/
    )
})

test("aborted or over-budget scans do not return partial rankings", async () => {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(
        buildHistoryReport(
            async () => {
                throw new Error("must not read")
            },
            { signal: controller.signal }
        ),
        /abort/i
    )
    await assert.rejects(
        buildHistoryReport(
            async () => ({
                items: [historyRecord()],
                revision: "1",
                nextCursor: "next",
                lastCollectedAt: null,
            }),
            { maxPages: 1 }
        ),
        /incomplete/
    )
})
