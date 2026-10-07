import { listReportMembers } from "./tickets-report-members"
import assert from "node:assert/strict"
import test from "node:test"
test("report access checks enumerate fresh members through bounded REST pages", async () => {
    const cursors: (string | undefined)[] = []
    const members = await listReportMembers(async (after) => {
        cursors.push(after)
        return after
            ? [{ id: "1001" }]
            : Array.from({ length: 1000 }, (_, i) => ({ id: String(i + 1) }))
    })
    assert.equal(members.length, 1001)
    assert.deepEqual(cursors, [undefined, "1000"])
})
test("report access checks fail closed for incomplete or nonprogressing inventory", async () => {
    const values = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i + 1),
    }))
    await assert.rejects(
        listReportMembers(async () => values),
        /pagination/
    )
    let count = 0
    await assert.rejects(
        listReportMembers(async () => {
            count++
            return values.map((v) => ({ id: `${count}-${v.id}` }))
        }),
        /too_large/
    )
    assert.equal(count, 10)
})
