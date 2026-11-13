import { withRequestLease } from "./request-lease"
import assert from "node:assert/strict"
import test from "node:test"

test("an unfenced legacy claim or expired claim cannot start external effects", async () => {
    let sends = 0
    await assert.rejects(
        withRequestLease(
            "reminder",
            { id: "r" },
            async () => {
                sends++
            },
            async () => true
        ),
        /updated backend/
    )
    await assert.rejects(
        withRequestLease(
            "reminder",
            { id: "r", claimToken: "owner" },
            async () => {
                sends++
            },
            async () => false
        ),
        /lease was lost/
    )
    assert.equal(sends, 0)
})

test("loss of ownership between recipients prevents every subsequent send", async () => {
    let renewals = 0
    const sent: string[] = []
    await assert.rejects(
        withRequestLease(
            "reminder",
            { id: "r", claimToken: "owner" },
            async (assertLease) => {
                for (const user of ["one", "two", "three"]) {
                    await assertLease()
                    sent.push(user)
                }
            },
            async () => ++renewals <= 2
        ),
        /lease was lost/
    )
    assert.deepEqual(sent, ["one"])
})

test("the heartbeat keeps a slow active send leased and drains on completion", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] })
    let finish!: () => void
    const active = new Promise<void>((resolve) => {
        finish = resolve
    })
    let renewals = 0
    const delivery = withRequestLease(
        "roster",
        { id: "r", claimToken: "owner" },
        async () => {
            await active
        },
        async () => {
            renewals++
            return true
        }
    )
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    t.mock.timers.tick(30_001)
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(renewals, 2)
    finish()
    await delivery
    t.mock.timers.tick(60_000)
    assert.equal(renewals, 2)
})
