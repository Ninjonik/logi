import * as members from "../../../convex/memberObservations"
import { canAdminServerContext } from "./server-read-model"
import * as feed from "../../../convex/integrationChanges"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "synthetic-membership-secret"
const secret = "synthetic-membership-secret"
const lookup = {
    secret,
    keyHash: "reader",
    guildId: "guild-a",
    discordUserId: "member-a",
    gameId: "wardogs",
    maxAgeMs: 60_000,
}
function fixture() {
    const ctx = testContext()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:reader",
        guildId: "guild-a",
        keyHash: "reader",
        readAccess: {
            resources: ["membership-summaries"],
            gameIds: ["wardogs"],
        },
    })
    ctx.db.seed("membershipIntegrationPolicies", {
        _id: "membershipIntegrationPolicies:one",
        apiKeyId: "apiKeys:reader",
        guildId: "guild-a",
        enabled: true,
        version: "1",
        games: [{ gameId: "wardogs", roleIds: ["allowed"] }],
        updatedAt: new Date().toISOString(),
    })
    return ctx
}

test("membership resolves an imported player's assignment through its explicit Discord binding", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:linked",
        id: "imported-player",
        discordId: "member-a",
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:linked",
        serverId: "guild-a",
        userId: "imported-player",
        gameId: "wardogs",
        type: "member",
        status: "active",
    })
    const record = await invoke(feed.readSyncRecord, ctx, {
        secret,
        keyHash: "reader",
        gameId: "wardogs",
        resource: "membership-summaries",
        id: "member-a",
    })
    assert.deepEqual(record.data.assignment, {
        type: "member",
        status: "active",
    })
})

test("membership never treats an unlinked imported ID as a Discord identity", async () => {
    const ctx = fixture()
    ctx.db.seed("users", { _id: "users:unlinked", id: "member-a" })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:unlinked",
        serverId: "guild-a",
        userId: "member-a",
        gameId: "wardogs",
        type: "member",
        status: "active",
    })
    const record = await invoke(feed.readSyncRecord, ctx, {
        secret,
        keyHash: "reader",
        gameId: "wardogs",
        resource: "membership-summaries",
        id: "member-a",
    })
    assert.equal(record.data.assignment, null)
})

test("completed reconciliation removes legacy-only admin cache in bounded pages and preserves newer members", async () => {
    const ctx = fixture()
    const oldTime = new Date(Date.now() - 120_000).toISOString()
    const seedCache = (
        userId: string,
        guildId = "guild-a",
        updatedAt = oldTime
    ) =>
        ctx.db.seed("discordMemberAccess", {
            _id: `discordMemberAccess:${guildId}:${userId}`,
            guildId,
            userId,
            roleIds: [],
            isAdmin: true,
            hasDashboardAccess: true,
            createdAt: oldTime,
            updatedAt,
        })
    for (let i = 0; i < 201; i++)
        seedCache(`departed-${String(i).padStart(3, "0")}`)
    seedCache("other-tenant", "guild-b")
    const hasAdmin = (userId: string) => {
        const access = ctx.db.tables.discordMemberAccess.find(
            (row) => row.guildId === "guild-a" && row.userId === userId
        )
        return canAdminServerContext({
            userId,
            serverAdminIds: [],
            discordAccess: access
                ? {
                      isAdmin: access.isAdmin === true,
                      hasDashboardAccess: access.hasDashboardAccess === true,
                  }
                : null,
        })
    }
    assert.equal(hasAdmin("departed-000"), true)
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    const run = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: 1,
        members: [
            {
                discordUserId: "still-present",
                roleIds: [],
                isAdmin: true,
                hasDashboardAccess: true,
            },
        ],
    })
    const discord = await import("../../../convex/discordSync")
    await invoke(discord.upsertMemberAccess, ctx, {
        secret,
        guildId: "guild-a",
        userId: "new-gateway-member",
        roleIds: [],
        isAdmin: true,
        hasDashboardAccess: true,
        observation: { epoch, observedAt: new Date().toISOString() },
    })
    // An older bot can still write the legacy endpoint without an observation.
    // Preserve writes at the snapshot boundary too: ISO timestamps have millisecond precision.
    seedCache("concurrent-legacy-write", "guild-a", run.observedAt)
    let done = false,
        calls = 0
    while (!done && calls++ < 10) {
        const before = ctx.db.tables.discordMemberAccess.length
        done = (
            await invoke(members.finishReconciliation, ctx, {
                secret,
                runId: run.id,
            })
        ).isDone
        assert.ok(before - ctx.db.tables.discordMemberAccess.length <= 100)
    }
    assert.equal(done, true)
    assert.equal(hasAdmin("departed-000"), false)
    assert.deepEqual(
        ctx.db.tables.discordMemberAccess.map((row) => row.userId).sort(),
        [
            "concurrent-legacy-write",
            "new-gateway-member",
            "other-tenant",
            "still-present",
        ]
    )
    assert.equal(
        ctx.db.tables.memberObservations.filter((row) => row.state === "left")
            .length,
        201
    )
    assert.equal(hasAdmin("new-gateway-member"), true)
    assert.equal(hasAdmin("still-present"), true)
})

test("legacy cache cleanup requires complete fetch proof and rejects a superseded epoch between pages", async () => {
    const ctx = fixture()
    ctx.db.seed("discordMemberAccess", {
        _id: "discordMemberAccess:legacy",
        guildId: "guild-a",
        userId: "legacy-admin",
        roleIds: [],
        isAdmin: true,
        hasDashboardAccess: true,
        createdAt: "2020-01-01T00:00:00Z",
        updatedAt: "2020-01-01T00:00:00Z",
    })
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    const run = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    await assert.rejects(
        invoke(members.finishReconciliation, ctx, { secret, runId: run.id }),
        /complete/i
    )
    assert.equal(ctx.db.tables.discordMemberAccess.length, 1)
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: 0,
        members: [],
    })
    assert.equal(
        (
            await invoke(members.finishReconciliation, ctx, {
                secret,
                runId: run.id,
            })
        ).isDone,
        false
    )
    await invoke(members.invalidateGuild, ctx, { secret, guildId: "guild-a" })
    await assert.rejects(
        invoke(members.finishReconciliation, ctx, { secret, runId: run.id }),
        /superseded/i
    )
    assert.equal(ctx.db.tables.discordMemberAccess.length, 1)
})
test("membership grant and per-key policy are both required and tenant/game bound", async () => {
    const ctx = fixture()
    assert.ok(await invoke(members.prepareLookup, ctx, lookup))
    assert.equal(
        await invoke(members.prepareLookup, ctx, {
            ...lookup,
            guildId: "other",
        }),
        null
    )
    assert.equal(
        await invoke(members.prepareLookup, ctx, {
            ...lookup,
            gameId: "hell_let_loose",
        }),
        null
    )
    ctx.db.tables.membershipIntegrationPolicies[0].enabled = false
    assert.equal(await invoke(members.prepareLookup, ctx, lookup), null)
    ctx.db.tables.membershipIntegrationPolicies[0].enabled = true
    ctx.db.tables.apiKeys[0].revokedAt = "now"
    assert.equal(await invoke(members.prepareLookup, ctx, lookup), null)
    delete ctx.db.tables.apiKeys[0].revokedAt
    ctx.db.tables.membershipIntegrationPolicies = []
    assert.equal(await invoke(members.prepareLookup, ctx, lookup), null)
})
test("privileged lookup refreshes after 60 seconds; receivedAt cannot grant freshness", async () => {
    const ctx = fixture()
    const epoch = await invoke(members.invalidateGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    await invoke(members.applyGateway, ctx, {
        secret,
        guildId: "guild-a",
        discordUserId: "member-a",
        epoch,
        state: "present",
        roleIds: ["allowed", "private"],
        observedAt: new Date(Date.now() - 61_000).toISOString(),
    })
    const prepared = await invoke(members.prepareLookup, ctx, lookup)
    assert.equal(prepared.kind, "refresh")
    const data = await invoke(members.completeLookup, ctx, {
        ...lookup,
        token: prepared.token,
        result: {
            state: "present",
            roleIds: ["allowed", "private"],
            observedAt: new Date().toISOString(),
        },
    })
    assert.deepEqual(data.roleIds, ["allowed"])
    assert.equal(
        (await invoke(members.prepareLookup, ctx, lookup)).kind,
        "cached"
    )
})
test("policy/key revocation during awaited REST discards provider data", async () => {
    for (const revoke of ["key", "policy"]) {
        const ctx = fixture(),
            prepared = await invoke(members.prepareLookup, ctx, lookup)
        if (revoke === "key") ctx.db.tables.apiKeys[0].revokedAt = "now"
        else ctx.db.tables.membershipIntegrationPolicies[0].version = "2"
        assert.equal(
            await invoke(members.completeLookup, ctx, {
                ...lookup,
                token: prepared.token,
                result: {
                    state: "present",
                    roleIds: ["allowed"],
                    observedAt: new Date().toISOString(),
                },
            }),
            null
        )
    }
})
test("newer departure defeats slow REST and role invalidation defeats old observations", async () => {
    const ctx = fixture(),
        prepared = await invoke(members.prepareLookup, ctx, lookup)
    await invoke(members.applyGateway, ctx, {
        secret,
        guildId: "guild-a",
        discordUserId: "member-a",
        epoch: prepared.token.epoch,
        state: "left",
        roleIds: [],
        observedAt: new Date().toISOString(),
    })
    const data = await invoke(members.completeLookup, ctx, {
        ...lookup,
        token: prepared.token,
        result: {
            state: "present",
            roleIds: ["allowed"],
            observedAt: new Date().toISOString(),
        },
    })
    assert.equal(data.state, "left")
    await invoke(members.invalidateGuild, ctx, { secret, guildId: "guild-a" })
    assert.notEqual(
        (await invoke(members.prepareLookup, ctx, lookup)).data?.state,
        "present"
    )
})
test("slow full snapshot cannot undo departure and unfinished fetch deletes nobody", async () => {
    const ctx = fixture(),
        epoch = await invoke(members.invalidateGuild, ctx, {
            secret,
            guildId: "guild-a",
        })
    await invoke(members.applyGateway, ctx, {
        secret,
        guildId: "guild-a",
        discordUserId: "member-a",
        epoch,
        state: "present",
        roleIds: ["allowed"],
        observedAt: new Date().toISOString(),
    })
    const run = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    await invoke(members.applyGateway, ctx, {
        secret,
        guildId: "guild-a",
        discordUserId: "member-a",
        epoch,
        state: "left",
        roleIds: [],
        observedAt: new Date().toISOString(),
    })
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: 1,
        members: [{ discordUserId: "member-a", roleIds: ["allowed"] }],
    })
    await invoke(members.finishReconciliation, ctx, { secret, runId: run.id })
    assert.equal(
        (await invoke(members.prepareLookup, ctx, lookup)).data.state,
        "left"
    )
    // A begin followed by a failed fetch has no completion proof; finishing is denied.
    const failed = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    await assert.rejects(
        invoke(members.finishReconciliation, ctx, { secret, runId: failed.id }),
        /complete/i
    )
    assert.equal(
        (await invoke(members.prepareLookup, ctx, lookup)).data.state,
        "left"
    )
})
test("REST outage preserves provider evidence, holds one reservation and respects global Retry-After", async () => {
    const ctx = fixture(),
        prepared = await invoke(members.prepareLookup, ctx, lookup)
    assert.equal(
        (await invoke(members.prepareLookup, ctx, lookup)).kind,
        "cached"
    )
    const old = new Date(Date.now() - 61000).toISOString()
    ctx.db.tables.memberObservations[0].state = "left"
    ctx.db.tables.memberObservations[0].observedAt = old
    const result = await invoke(members.completeLookup, ctx, {
        ...lookup,
        token: prepared.token,
        result: {
            state: "unknown",
            roleIds: [],
            observedAt: null,
            retryAfterMs: 120000,
        },
    })
    assert.equal(result.state, "unknown")
    assert.equal(result.observedAt, old)
    assert.equal(ctx.db.tables.memberObservations[0].state, "left")
    assert.ok(
        ctx.db.tables.membershipRefreshLimits[0].until >= Date.now() + 119000
    )
    assert.equal(
        (
            await invoke(members.prepareLookup, ctx, {
                ...lookup,
                discordUserId: "other",
            })
        ).kind,
        "cached"
    )
})
test("actual Discord ingress rejects old epochs and reconciliation cannot restore its departed member cache", async () => {
    const discord = await import("../../../convex/discordSync")
    const ctx = fixture(),
        epoch = await invoke(members.ensureGuild, ctx, {
            secret,
            guildId: "guild-a",
        })
    const observedAt = new Date().toISOString()
    const botSecret =
        process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"
    await invoke(discord.upsertMemberAccess, ctx, {
        secret: botSecret,
        guildId: "guild-a",
        userId: "member-a",
        roleIds: ["allowed"],
        isAdmin: false,
        hasDashboardAccess: false,
        observation: { epoch, observedAt },
    })
    const run = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    await invoke(discord.removeMemberAccess, ctx, {
        secret: botSecret,
        guildId: "guild-a",
        userId: "member-a",
        observation: { epoch, observedAt: new Date().toISOString() },
    })
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: 1,
        members: [
            {
                discordUserId: "member-a",
                roleIds: ["allowed"],
                isAdmin: false,
                hasDashboardAccess: false,
            },
        ],
    })
    await invoke(members.finishReconciliation, ctx, { secret, runId: run.id })
    assert.equal(ctx.db.tables.discordMemberAccess.length, 0)
    const newEpoch = await invoke(members.invalidateGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    assert.notEqual(epoch, newEpoch)
    await invoke(discord.upsertMemberAccess, ctx, {
        secret: botSecret,
        guildId: "guild-a",
        userId: "member-a",
        roleIds: ["allowed"],
        isAdmin: false,
        hasDashboardAccess: false,
        observation: { epoch, observedAt: new Date().toISOString() },
    })
    assert.equal(ctx.db.tables.discordMemberAccess.length, 0)
    await assert.rejects(
        invoke(members.finishReconciliation, ctx, { secret, runId: run.id }),
        /superseded/
    )
})
test("membership feed binds one subject and resets after policy or provider epoch changes", async () => {
    const ctx = fixture(),
        epoch = await invoke(members.ensureGuild, ctx, {
            secret,
            guildId: "guild-a",
        })
    const args = {
        secret,
        keyHash: "reader",
        gameId: "wardogs",
        resources: ["membership-summaries"],
        discordUserId: "member-a",
        limit: 100,
    }
    assert.equal(
        await invoke(feed.readChanges, ctx, {
            ...args,
            discordUserId: undefined,
            startNow: true,
        }),
        null
    )
    const start = await invoke(feed.readChanges, ctx, {
        ...args,
        startNow: true,
    })
    ctx.db.seed("webhookSubscriptions", {
        _id: "webhookSubscriptions:public",
        guildId: "guild-a",
        enabled: true,
        eventTypes: ["integration.changed"],
    })
    for (const discordUserId of ["member-a", "member-b"])
        await invoke(members.applyGateway, ctx, {
            secret,
            guildId: "guild-a",
            discordUserId,
            epoch,
            state: "present",
            roleIds: ["allowed"],
            observedAt: new Date().toISOString(),
        })
    const cursor = {
        ...args,
        afterRevision: start.revision,
        membershipScopeVersion: start.membershipScopeVersion,
        issuedAt: Date.now(),
    }
    assert.equal(
        (await invoke(feed.readChanges, ctx, cursor)).resetRequired,
        true
    )
    assert.equal(ctx.db.tables.webhookDeliveries?.length ?? 0, 0)
    ctx.db.tables.membershipIntegrationPolicies[0].version = "50"
    assert.equal(
        (await invoke(feed.readChanges, ctx, cursor)).resetRequired,
        true
    )
    ctx.db.tables.membershipIntegrationPolicies[0].version = "1"
    await invoke(members.invalidateGuild, ctx, { secret, guildId: "guild-a" })
    assert.equal(
        (await invoke(feed.readChanges, ctx, cursor)).resetRequired,
        true
    )
    ctx.db.tables.membershipIntegrationPolicies[0].enabled = false
    assert.equal(
        await invoke(feed.readChanges, ctx, { ...args, startNow: true }),
        null
    )
})
test("successful refresh still holds the per-subject cooldown and guild refresh budget", async (t) => {
    let now = Date.now()
    t.mock.method(Date, "now", () => now)
    const ctx = fixture(),
        input = { ...lookup, maxAgeMs: 1000 }
    const prepared = await invoke(members.prepareLookup, ctx, input)
    await invoke(members.completeLookup, ctx, {
        ...input,
        token: prepared.token,
        result: {
            state: "present",
            roleIds: ["allowed"],
            observedAt: new Date(now).toISOString(),
        },
    })
    now += 1100
    const limited = await invoke(members.prepareLookup, ctx, input)
    assert.equal(limited.kind, "cached")
    assert.equal(limited.data.state, "unknown")
    for (let index = 1; index < 30; index++)
        assert.equal(
            (
                await invoke(members.prepareLookup, ctx, {
                    ...input,
                    discordUserId: `member-${index}`,
                })
            ).kind,
            "refresh"
        )
    assert.equal(
        (
            await invoke(members.prepareLookup, ctx, {
                ...input,
                discordUserId: "budget-exhausted",
            })
        ).kind,
        "cached"
    )
})
test("policy writes bind current key/game and the projection returns only its configured roles", async () => {
    const ctx = fixture(),
        base = {
            secret,
            guildId: "guild-a",
            apiKeyId: "apiKeys:reader",
            enabled: true,
            games: [{ gameId: "wardogs", roleIds: ["333333333333333333"] }],
        }
    for (const bad of [
        { ...base, guildId: "other" },
        { ...base, games: [{ gameId: "hell_let_loose", roleIds: [] }] },
        { ...base, games: [{ gameId: "wardogs", roleIds: ["invalid"] }] },
    ])
        await assert.rejects(
            invoke(members.configurePolicy, ctx, bad),
            /Invalid membership policy/
        )
    await invoke(members.configurePolicy, ctx, base)
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    await invoke(members.applyGateway, ctx, {
        secret,
        guildId: "guild-a",
        discordUserId: "member-a",
        epoch,
        state: "present",
        roleIds: ["333333333333333333", "444444444444444444"],
        observedAt: new Date().toISOString(),
    })
    assert.deepEqual(
        (await invoke(members.prepareLookup, ctx, lookup)).data.roleIds,
        ["333333333333333333"]
    )
    await invoke(members.configurePolicy, ctx, { ...base, enabled: false })
    assert.equal(await invoke(members.prepareLookup, ctx, lookup), null)
})

test("an observation with the same state, roles and epoch refreshes evidence without a revision or feed entry", async () => {
    const ctx = fixture(),
        epoch = await invoke(members.ensureGuild, ctx, {
            secret,
            guildId: "guild-a",
        })
    const observe = (roleIds: string[], observedAt: string) =>
        invoke(members.applyGateway, ctx, {
            secret,
            guildId: "guild-a",
            discordUserId: "member-a",
            epoch,
            state: "present",
            roleIds,
            observedAt,
        })
    const observation = () => ctx.db.tables.memberObservations[0]
    const guild = () => ctx.db.tables.membershipGuilds[0]
    const first = new Date(Date.now() - 20_000).toISOString(),
        second = new Date(Date.now() - 10_000).toISOString()
    await observe(["allowed", "other"], first)
    const written = {
        revision: observation().revision,
        guildRevision: guild().revision,
    }
    // The reconciliation path: same roles in a different order, newer evidence.
    await observe(["other", "allowed"], second)
    assert.equal(observation().revision, written.revision)
    assert.equal(guild().revision, written.guildRevision)
    assert.equal(observation().observedAt, second, "evidence is refreshed")
    const run = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: 1,
        members: [{ discordUserId: "member-a", roleIds: ["allowed", "other"] }],
    })
    assert.equal(
        observation().seenRunId,
        run.id,
        "the run still marks the member as seen"
    )
    assert.equal(observation().revision, written.revision)
    // Evidence older than the reconciliation's is refused, so the change is
    // observed at the time of the call, never at a time captured earlier.
    await observe(["allowed"], new Date().toISOString())
    assert.notEqual(observation().revision, written.revision)
    assert.notEqual(guild().revision, written.guildRevision)
})

test("a reconciliation sweep leaves departed members untouched and departs only the unseen present ones", async () => {
    const ctx = fixture(),
        epoch = await invoke(members.ensureGuild, ctx, {
            secret,
            guildId: "guild-a",
        })
    const old = new Date(Date.now() - 600_000).toISOString()
    for (const [discordUserId, state] of [
        ["gone-long-ago", "left"],
        ["still-here", "present"],
        ["vanished", "present"],
    ] as const)
        ctx.db.seed("memberObservations", {
            _id: `memberObservations:${discordUserId}`,
            guildId: "guild-a",
            discordUserId,
            state,
            roleIds: state === "present" ? ["allowed"] : [],
            observedAt: old,
            receivedAt: old,
            epoch,
            // At the guild's own revision, so the run does not treat the rows as
            // newer than its start.
            revision: "0",
            unavailable: false,
            refreshFence: 0,
            refreshUntil: 0,
            nextRefreshAt: 0,
        })
    const row = (id: string) =>
        ctx.db.tables.memberObservations.find(
            (candidate) => candidate.discordUserId === id
        )!
    const run = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: 1,
        members: [{ discordUserId: "still-here", roleIds: ["allowed"] }],
    })
    let done = false,
        calls = 0
    while (!done && calls++ < 10)
        done = (
            await invoke(members.finishReconciliation, ctx, {
                secret,
                runId: run.id,
            })
        ).isDone
    assert.equal(done, true)
    assert.equal(
        row("gone-long-ago").receivedAt,
        old,
        "a departed member is not rewritten"
    )
    assert.equal(row("gone-long-ago").revision, "0")
    assert.equal(
        row("vanished").state,
        "left",
        "an unseen present member departs"
    )
    assert.notEqual(row("vanished").revision, "0")
    assert.equal(row("still-here").state, "present")
    assert.equal(
        row("still-here").revision,
        "0",
        "an unchanged member keeps its revision"
    )
    assert.notEqual(
        row("still-here").observedAt,
        old,
        "but its evidence is refreshed"
    )
})
