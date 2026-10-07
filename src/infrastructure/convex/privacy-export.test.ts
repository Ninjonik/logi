import { invoke, spyReads, testContext } from "./testing/database"
import { exportForUser } from "../../../convex/privacy"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET

test("the personal data export answers without the removed link-token table", async () => {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:1",
        id: "logi-1",
        discordId: "100000000000000001",
        name: "Player",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:1",
        userId: "logi-1",
        serverId: "guild-a",
    })
    ctx.db.seed("privacyRequests", {
        _id: "privacyRequests:1",
        userId: "logi-1",
        type: "export",
        status: "requested",
    })
    ctx.db.seed("events", {
        _id: "events:1",
        guildId: "guild-a",
        name: "Friendly",
        participants: [{ userId: "logi-1", status: "attending" }],
    })
    // Rows a deployment may still hold in the table the schema no longer has.
    ctx.db.seed("platformIdLinkTokens", {
        _id: "platformIdLinkTokens:1",
        userId: "logi-1",
    })
    const reads = spyReads(ctx)
    const data = await invoke(exportForUser, ctx, { secret, userId: "logi-1" })
    assert.deepEqual(Object.keys(data).sort(), [
        "assignments",
        "eventParticipation",
        "generatedAt",
        "performanceHistory",
        "playerStats",
        "privacyRequests",
        "rosterPlacements",
        "user",
        "verifiedPlatformLinks",
    ])
    assert.equal(data.user.id, "logi-1")
    assert.equal(data.assignments.length, 1)
    assert.equal(data.privacyRequests.length, 1)
    assert.deepEqual(
        data.eventParticipation.map(
            (entry: { eventId: string }) => entry.eventId
        ),
        ["events:1"]
    )
    assert.ok(!reads.some((read) => read.table === "platformIdLinkTokens"))
})
