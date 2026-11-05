import { seedDashboardActor } from "./testing/dashboard-actor"
import { publish, save } from "../../../convex/eventDrafts"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"
process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const input = {
    secret: process.env.INTERNAL_AUTH_SECRET,
    serverId: "guilds:admin",
    gameId: "wardogs",
    kind: "match",
    name: "Manual fixture",
    wardogsFixtureUrl:
        "https://wardogsleague.net/matches/cmvjzz9tz03nvml015t5vzlpa/",
    registrationEnd: "2027-01-19T18:30:00Z",
    meetingStart: "2027-01-20T18:30:00Z",
    gameStart: "2027-01-20T19:00:00Z",
    gameEnd: "2027-01-20T20:30:00Z",
    pingClan: false,
}
test("drafts retain the link without reserving it; publishing binds once and competing publishes roll back", async () => {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    const draft = await invoke(save, ctx, input)
    assert.equal(
        ctx.db.tables.events[0].wardogsFixtureUrl,
        input.wardogsFixtureUrl.slice(0, -1)
    )
    assert.equal(ctx.db.tables.leagueAutoImportFixtures?.length ?? 0, 0)
    await invoke(publish, ctx, { ...input, eventId: draft.eventId })
    assert.equal(ctx.db.tables.leagueAutoImportFixtures.length, 1)
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].eventId, draft.eventId)
    await assert.rejects(invoke(publish, ctx, input), /already linked/)
    assert.equal(ctx.db.tables.events.length, 1)
})
