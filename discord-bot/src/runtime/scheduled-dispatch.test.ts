import { startScheduledDispatch } from "./scheduled-dispatch"
import test, { afterEach, type TestContext } from "node:test"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { closeConvexClient } from "../convex"
import assert from "node:assert/strict"

afterEach(closeConvexClient)
function signal(t: TestContext) {
    t.mock.method(ConvexReactClient.prototype, "watchQuery", () => ({
        localQueryResult: () => ({ key: "dispatch", dueAt: 0 }),
        onUpdate: () => () => {},
    }))
}

test("dispatch shutdown finishes the active acknowledgment and claims no new work", async (t) => {
    signal(t)
    let claims = 0,
        acknowledged = 0,
        processing = false
    let finish!: () => void
    const active = new Promise<void>((resolve) => {
        finish = resolve
    })
    const row = {
        id: "dispatch",
        eventId: "event",
        guildId: "guild",
        kind: "refresh-announcement",
        claimToken: "owner",
        dueAt: "2026-11-12T12:00:00Z",
        changedEventIds: ["event"],
        scoreEventIds: [],
    }
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            switch (getFunctionName(reference)) {
                case "discordScheduledDispatch:claim":
                    claims++
                    return row
                case "discordRequestRecovery:heartbeat":
                    return true
                case "discordScheduledDispatch:acknowledge":
                    acknowledged++
                    return null
                default:
                    throw new Error("Unexpected mutation")
            }
        }
    )
    const stop = startScheduledDispatch(async () => {
        processing = true
        await active
    })
    for (let i = 0; i < 12; i++) await Promise.resolve()
    assert.equal(processing, true)
    let drained = false
    const stopping = stop().then(() => {
        drained = true
    })
    await Promise.resolve()
    assert.equal(drained, false)
    assert.equal(acknowledged, 0)
    finish()
    await stopping
    assert.equal(acknowledged, 1)
    assert.equal(claims, 1)
})

test("failed retry persistence is reported while the leased dispatch remains recoverable", async (t) => {
    signal(t)
    let claims = 0,
        retries = 0
    const warnings: string[] = []
    t.mock.method(console, "warn", (...args: unknown[]) =>
        warnings.push(args.map(String).join(" "))
    )
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            switch (getFunctionName(reference)) {
                case "discordScheduledDispatch:claim":
                    return claims++ === 0
                        ? {
                              id: "dispatch",
                              eventId: "event",
                              guildId: "guild",
                              kind: "refresh-announcement",
                              claimToken: "owner",
                              changedEventIds: [],
                              scoreEventIds: [],
                          }
                        : null
                case "discordRequestRecovery:heartbeat":
                    return true
                case "discordScheduledDispatch:retry":
                    retries++
                    throw new Error("Database unavailable")
                default:
                    throw new Error("Unexpected mutation")
            }
        }
    )
    const stop = startScheduledDispatch(async () => {
        throw new Error("processing failed")
    })
    for (let i = 0; i < 50 && retries === 0; i++) await Promise.resolve()
    await stop()
    assert.equal(retries, 1)
    assert.ok(
        warnings.some((message) => message.includes("Retry scheduling failed"))
    )
})
