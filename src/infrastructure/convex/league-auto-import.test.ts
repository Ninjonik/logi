import {
    read,
    save,
    claim,
    importFixture,
} from "../../../convex/leagueAutoImport"
import { fixture, template, settings } from "../testing/wardogs-team-fixtures"
import { seedDashboardActor, actorFixture } from "./testing/dashboard-actor"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"
process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const access = {
    secret: process.env.INTERNAL_AUTH_SECRET,
    guildId: "guild-a",
    actor: actorFixture,
}
const credentialJson = JSON.stringify({
    format: 1,
    keyId: "test",
    nonce: "a".repeat(16),
    ciphertext: "a".repeat(20),
    tag: "a".repeat(22),
})
async function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db)
    Object.assign(ctx.db.tables.guilds[0], {
        enabledGames: ["wardogs"],
        matchTemplates: [template],
    })
    await invoke(save, ctx, {
        ...access,
        settingsJson: JSON.stringify(settings),
        credentialJson,
    })
    return ctx
}
async function run(ctx: ReturnType<typeof testContext>, patch = {}) {
    const config = await invoke(claim, ctx, {})
    assert.ok(config)
    await invoke(importFixture, ctx, {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
        fixtureJson: JSON.stringify({
            ...fixture,
            scheduledAt: new Date(Date.now() + 10 * 86400_000).toISOString(),
            ...patch,
        }),
    })
    return config
}
test("settings require current clan admin and Wardogs; credentials never appear in the read model", async () => {
    const ctx = await setup()
    await assert.rejects(invoke(read, ctx, { ...access, secret: "bad" }))
    const state = await invoke(read, ctx, access)
    assert.equal(state.hasKey, true)
    assert.equal(JSON.stringify(state).includes("ciphertext"), false)
    ctx.db.tables.guilds[0].enabledGames = ["hell_let_loose"]
    await assert.rejects(
        invoke(save, ctx, {
            ...access,
            settingsJson: JSON.stringify(settings),
        }),
        /Wardogs/
    )
})
test("replay creates one native match and schedule; updates retain signups and local fields", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    assert.equal(event.gameId, "wardogs")
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].eventId, event._id)
    assert.ok(ctx.db.tables.eventScheduleJobs.length)
    event.name = "Manager title"
    event.signUps = [{ userId: "person", role: "infantry" }]
    const args = {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
    }
    await invoke(importFixture, ctx, {
        ...args,
        fixtureJson: JSON.stringify({
            ...fixture,
            map: "Ozeti",
            scheduledAt: event.gameStart,
        }),
    })
    assert.equal(ctx.db.tables.events.length, 1)
    assert.equal(event.name, "Manager title")
    assert.equal(event.map, "Ozeti")
    assert.equal(event.signUps.length, 1)
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "team_matching_required"
    )
    // A stale worker cannot write after settings change.
    await invoke(save, ctx, {
        ...access,
        settingsJson: JSON.stringify({ ...settings, enabled: false }),
    })
    await invoke(importFixture, ctx, {
        ...args,
        fixtureJson: JSON.stringify({ ...fixture, map: "Stale map" }),
    })
    assert.equal(event.map, "Ozeti")
})
test("deleted imported matches never reappear and manual fixture links are preserved", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    await ctx.db.delete(event._id)
    await invoke(importFixture, ctx, {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
        fixtureJson: JSON.stringify(fixture),
    })
    assert.equal(ctx.db.tables.events.length, 0)
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "match_deleted"
    )
})

test("manual fixture bindings prevent duplicate native creation", async () => {
    const ctx = await setup()
    ctx.db.seed("leagueTrackedMatches", {
        _id: "leagueTrackedMatches:manual",
        guildId: access.guildId,
        matchId: fixture.id,
        eventId: "events:manual",
        ignored: false,
        paused: false,
    })
    await run(ctx)
    assert.equal(ctx.db.tables.events?.length ?? 0, 0)
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "manually_managed"
    )
    assert.equal(ctx.db.tables.leagueTrackedMatches[0].eventId, "events:manual")
})
test("cross-clan event links fail closed and cancellation retains existing signups", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    const args = {
        id: config._id,
        fence: config.fence,
        revision: config.revision,
    }
    event.signUps = [{ userId: "player" }]
    await invoke(importFixture, ctx, {
        ...args,
        fixtureJson: JSON.stringify({ ...fixture, status: "CANCELLED" }),
    })
    assert.equal(
        ctx.db.tables.leagueAutoImportFixtures[0].issue,
        "cancelled_or_postponed"
    )
    assert.equal(event.signUps.length, 1)
    event.guildId = "other-clan"
    await assert.rejects(
        invoke(importFixture, ctx, {
            ...args,
            fixtureJson: JSON.stringify(fixture),
        }),
        /scope mismatch/
    )
})
test("defaults change new imports only, and registrationStart reaches the shared signup repository", async () => {
    const ctx = await setup()
    const config = await run(ctx)
    const event = ctx.db.tables.events[0]
    const opensAt = event.registrationStart
    await invoke(save, ctx, {
        ...access,
        settingsJson: JSON.stringify({
            ...settings,
            registrationHoursBeforeStart: 240,
        }),
    })
    const next = await invoke(claim, ctx, {})
    await invoke(importFixture, ctx, {
        id: next._id,
        fence: next.fence,
        revision: next.revision,
        fixtureJson: JSON.stringify({
            ...fixture,
            scheduledAt: event.gameStart,
        }),
    })
    assert.equal(event.registrationStart, opensAt)
    const { ConvexEventWorkflowRepository } =
        await import("./event-workflow-repositories")
    const repository = new ConvexEventWorkflowRepository(ctx as never)
    assert.equal(
        (await repository.getById(event._id))?.registrationStart,
        opensAt
    )
    assert.notEqual(config.revision, next.revision)
})
