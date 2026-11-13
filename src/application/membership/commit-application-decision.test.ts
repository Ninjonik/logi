import { commitApplicationDecision } from "./commit-application-decision"
import assert from "node:assert/strict"
import test from "node:test"

test("mercenary movement writes the destination before removing the original and closes in the transaction", async () => {
    const calls: unknown[] = []
    const result = await commitApplicationDecision(
        {
            upsert: async (input) => {
                calls.push(input)
                return "destination"
            },
            remove: async (id) => {
                calls.push(["remove", id])
            },
            close: async (input) => {
                calls.push(["close", input])
            },
        },
        {
            outcome: "mercenary",
            application: { categoryId: "member", gameId: "hell_let_loose" },
            assignment: { id: "original", type: "member" },
            assignments: [{ id: "existing", gameId: "wardogs" }],
            categories: [
                { id: "merc", gameId: "wardogs", assignmentType: "mercenary" },
            ],
            categoryType: "member",
        }
    )
    assert.deepEqual(calls, [
        {
            assignmentId: "existing",
            gameId: "wardogs",
            type: "mercenary",
            status: "active",
            categoryId: "merc",
        },
        ["remove", "original"],
        ["close", { assignmentId: "destination", gameId: "wardogs" }],
    ])
    assert.deepEqual(result, { assignmentId: "destination", gameId: "wardogs" })
})

test("a failed membership change cannot proceed to closure", async () => {
    let closed = false
    await assert.rejects(
        commitApplicationDecision(
            {
                upsert: async () => {
                    throw new Error("write failed")
                },
                remove: async () => {},
                close: async () => {
                    closed = true
                },
            },
            {
                outcome: "member",
                application: { categoryId: "member" },
                assignment: null,
                assignments: [],
                categories: [],
                categoryType: "member",
            }
        ),
        /write failed/
    )
    assert.equal(closed, false)
})
