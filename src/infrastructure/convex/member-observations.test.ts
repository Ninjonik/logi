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
    const changes = await invoke(feed.readChanges, ctx, cursor)
    assert.equal(changes.items.length, 1)
    assert.equal(changes.items[0].id, "member-a")
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
    const feedRows = () => ctx.db.tables.integrationChanges?.length ?? 0
    const observation = () => ctx.db.tables.memberObservations[0]
    const guild = () => ctx.db.tables.membershipGuilds[0]
    const first = new Date(Date.now() - 20_000).toISOString(),
        second = new Date(Date.now() - 10_000).toISOString()
    await observe(["allowed", "other"], first)
    const written = {
        feed: feedRows(),
        revision: observation().revision,
        guildRevision: guild().revision,
    }
    assert.ok(written.feed > 0, "a first observation is a change")
    // The reconciliation path: same roles in a different order, newer evidence.
    await observe(["other", "allowed"], second)
    assert.equal(feedRows(), written.feed, "no feed entry for unchanged roles")
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
        feedRows(),
        written.feed,
        "a reconciliation of an unchanged member writes no feed entry"
    )
    assert.equal(
        observation().seenRunId,
        run.id,
        "the run still marks the member as seen"
    )
    assert.equal(observation().revision, written.revision)
    // Evidence older than the reconciliation's is refused, so the change is
    // observed at the time of the call, never at a time captured earlier.
    await observe(["allowed"], new Date().toISOString())
    assert.ok(feedRows() > written.feed, "a role change is a change")
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
    assert.deepEqual(
        [
            ...new Set(
                ctx.db.tables.integrationChanges.map((change) => change.id)
            ),
        ],
        ["vanished"],
        "only the departure reaches the feed"
    )
})

/** Writes per table, from the fake's `table:n` ids, until `restore`. */
function countWrites(ctx: ReturnType<typeof fixture>) {
    const writes: Record<string, number> = {}
    const count = (id: string) => {
        const table = id.split(":")[0]
        writes[table] = (writes[table] ?? 0) + 1
    }
    const insert = ctx.db.insert.bind(ctx.db),
        patch = ctx.db.patch.bind(ctx.db),
        remove = ctx.db.delete.bind(ctx.db)
    ctx.db.insert = async (table: string, value: Record<string, unknown>) => {
        count(`${table}:`)
        return insert(table, value)
    }
    ctx.db.patch = async (id: string, value: Record<string, unknown>) => {
        count(id)
        return patch(id, value)
    }
    ctx.db.delete = async (id: string) => {
        count(id)
        return remove(id)
    }
    const restore = () => {
        ctx.db.insert = insert
        ctx.db.patch = patch
        ctx.db.delete = remove
    }
    return { writes, restore }
}
type Fetched = {
    discordUserId: string
    roleIds: string[]
    isAdmin?: boolean
    hasDashboardAccess?: boolean
}
/** The bot's order: read the start, fetch, then insert the run. */
async function startRun(ctx: ReturnType<typeof fixture>) {
    const observedAt = new Date().toISOString()
    const start = await invoke(members.reconciliationStart, ctx, {
        secret,
        guildId: "guild-a",
    })
    return { ...start, observedAt }
}
async function beginRun(
    ctx: ReturnType<typeof fixture>,
    start: { epoch: string; revision: string; observedAt: string }
) {
    return invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch: start.epoch,
        startedRevision: start.revision,
        observedAt: start.observedAt,
    })
}
async function finishRun(ctx: ReturnType<typeof fixture>, runId: string) {
    let done = false,
        calls = 0
    while (!done && calls++ < 20)
        done = (
            await invoke(members.finishReconciliation, ctx, { secret, runId })
        ).isDone
    assert.equal(done, true)
}
async function reconcile(ctx: ReturnType<typeof fixture>, fetched: Fetched[]) {
    const run = await beginRun(ctx, await startRun(ctx))
    const batch = countWrites(ctx)
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: fetched.length,
        members: fetched,
    })
    batch.restore()
    const sweep = countWrites(ctx)
    await finishRun(ctx, run.id)
    sweep.restore()
    return { run, batch: batch.writes, sweep: sweep.writes }
}
const botSecret = () =>
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"
const access = (userId: string, roleIds: string[], isAdmin = false) => ({
    discordUserId: userId,
    roleIds,
    isAdmin,
    hasDashboardAccess: isAdmin,
})

test("a reconciliation of an unchanged member writes its observation's evidence and nothing else", async () => {
    const ctx = fixture()
    const discord = await import("../../../convex/discordSync")
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    await invoke(discord.upsertMemberAccess, ctx, {
        secret: botSecret(),
        guildId: "guild-a",
        userId: "member-a",
        roleIds: ["allowed", "other"],
        isAdmin: false,
        hasDashboardAccess: false,
        observation: {
            epoch,
            observedAt: new Date(Date.now() - 1000).toISOString(),
        },
    })
    const feedRows = ctx.db.tables.integrationChanges.length
    const accessRow = structuredClone(ctx.db.tables.discordMemberAccess[0])
    // Roles in another order are the same roles.
    const { run, batch, sweep } = await reconcile(ctx, [
        access("member-a", ["other", "allowed"]),
    ])
    assert.deepEqual(batch, {
        memberObservations: 1,
        membershipSyncRuns: 1,
    })
    assert.deepEqual(sweep, {
        // sweeping → cache-sweeping → complete, and the dashboard's time.
        membershipSyncRuns: 2,
        membershipGuilds: 1,
    })
    assert.equal(ctx.db.tables.membershipSyncSubjects, undefined)
    assert.deepEqual(ctx.db.tables.discordMemberAccess[0], accessRow)
    assert.equal(ctx.db.tables.integrationChanges.length, feedRows)
    assert.equal(ctx.db.tables.memberObservations[0].seenRunId, run.id)
    assert.equal(
        ctx.db.tables.membershipGuilds[0].lastFullSyncAt,
        run.observedAt
    )
})

test("after an invalidation an unchanged member takes the new epoch without a revision or a feed row", async () => {
    const ctx = fixture()
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    for (const discordUserId of ["member-a", "member-b"])
        await invoke(members.applyGateway, ctx, {
            secret,
            guildId: "guild-a",
            discordUserId,
            epoch,
            state: "present",
            roleIds: ["allowed"],
            observedAt: new Date(Date.now() - 1000).toISOString(),
        })
    const row = (id: string) =>
        ctx.db.tables.memberObservations.find(
            (candidate) => candidate.discordUserId === id
        )!
    const before = {
        feed: ctx.db.tables.integrationChanges.length,
        revision: row("member-a").revision,
        guildRevision: ctx.db.tables.membershipGuilds[0].revision,
    }
    const newEpoch = await invoke(members.invalidateGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    assert.notEqual(newEpoch, epoch)
    assert.equal(
        (await invoke(members.prepareLookup, ctx, lookup)).kind,
        "refresh",
        "an observation under the old epoch is not fresh"
    )
    ctx.db.tables.memberObservations.forEach((observation) => {
        observation.refreshUntil = 0
        observation.nextRefreshAt = 0
    })
    const { batch } = await reconcile(ctx, [
        { discordUserId: "member-a", roleIds: ["allowed"] },
    ])
    assert.deepEqual(batch, {
        memberObservations: 1,
        membershipSyncRuns: 1,
    })
    assert.equal(row("member-a").epoch, newEpoch)
    assert.equal(row("member-a").revision, before.revision)
    assert.equal(
        ctx.db.tables.membershipGuilds[0].revision !== before.guildRevision,
        true,
        "only member-b's departure moved the guild revision"
    )
    assert.deepEqual(
        [
            ...new Set(
                ctx.db.tables.integrationChanges
                    .slice(before.feed)
                    .map((change) => change.id)
            ),
        ],
        ["member-b"],
        "the epoch alone adds no feed row"
    )
    const fresh = await invoke(members.prepareLookup, ctx, lookup)
    assert.equal(fresh.kind, "cached")
    assert.equal(fresh.data.state, "present")
    assert.equal(fresh.data.epoch, newEpoch)
    // A gateway event of the same roles under the new epoch: evidence only.
    const third = await invoke(members.invalidateGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    const feed = ctx.db.tables.integrationChanges.length
    await invoke(members.applyGateway, ctx, {
        secret,
        guildId: "guild-a",
        discordUserId: "member-a",
        epoch: third,
        state: "present",
        roleIds: ["allowed"],
        observedAt: new Date().toISOString(),
    })
    assert.equal(row("member-a").epoch, third)
    assert.equal(row("member-a").revision, before.revision)
    assert.equal(ctx.db.tables.integrationChanges.length, feed)
})

test("the sweep spares members a gateway event wrote during the run, and departs the unseen ones", async () => {
    const ctx = fixture()
    const discord = await import("../../../convex/discordSync")
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    const gateway = (discordUserId: string, roleIds: string[]) =>
        invoke(discord.upsertMemberAccess, ctx, {
            secret: botSecret(),
            guildId: "guild-a",
            userId: discordUserId,
            roleIds,
            isAdmin: false,
            hasDashboardAccess: false,
            observation: { epoch, observedAt: new Date().toISOString() },
        })
    for (const id of ["changed", "unchanged", "departed"])
        await gateway(id, ["allowed"])
    const row = (id: string) =>
        ctx.db.tables.memberObservations.find(
            (candidate) => candidate.discordUserId === id
        )
    const start = await startRun(ctx)
    // During the Discord fetch: a role change, and a member who joins after
    // the fetch read the member list.
    await gateway("changed", ["allowed", "new-role"])
    await gateway("joined", ["allowed"])
    const run = await beginRun(ctx, start)
    // The fetch saw the role change's old roles and not the newcomer.
    await invoke(members.applyReconciliationBatch, ctx, {
        secret,
        runId: run.id,
        batch: 0,
        expectedCount: 2,
        members: [
            access("changed", ["allowed"]),
            access("unchanged", ["allowed"]),
        ],
    })
    assert.equal(row("unchanged")!.seenRunId, run.id)
    // A gateway event that changes nothing keeps the run's mark.
    await gateway("unchanged", ["allowed"])
    assert.equal(row("unchanged")!.seenRunId, run.id)
    await finishRun(ctx, run.id)
    assert.deepEqual(row("changed")!.roleIds, ["allowed", "new-role"])
    assert.equal(row("changed")!.state, "present")
    assert.equal(row("unchanged")!.state, "present")
    assert.equal(row("joined")!.state, "present")
    assert.equal(row("departed")!.state, "left")
    assert.deepEqual(
        ctx.db.tables.discordMemberAccess.map((entry) => entry.userId).sort(),
        ["changed", "joined", "unchanged"]
    )
    // The duplicate check reads the run's mark instead of a scratch row.
    const again = await beginRun(ctx, await startRun(ctx))
    await assert.rejects(
        invoke(members.applyReconciliationBatch, ctx, {
            secret,
            runId: again.id,
            batch: 0,
            expectedCount: 2,
            members: [
                access("unchanged", ["allowed"]),
                access("unchanged", ["allowed"]),
            ],
        }),
        /Duplicate/
    )
})

test("a run starts from the revision read before the fetch, never from a later or stale one", async () => {
    const ctx = fixture()
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    const start = await startRun(ctx)
    assert.deepEqual(
        { epoch: start.epoch, revision: start.revision },
        { epoch, revision: "0" }
    )
    const runs = () => ctx.db.tables.membershipSyncRuns ?? []
    assert.equal(runs().length, 0, "reading the start writes nothing")
    await assert.rejects(
        beginRun(ctx, { ...start, revision: "5" }),
        /Invalid reconciliation start/
    )
    await assert.rejects(
        beginRun(ctx, {
            ...start,
            observedAt: new Date(Date.now() - 11 * 60_000).toISOString(),
        }),
        /Invalid reconciliation start/
    )
    // A bot clock ahead of the backend's cannot date evidence in the future.
    const ahead = await beginRun(ctx, {
        ...start,
        observedAt: new Date(Date.now() + 60_000).toISOString(),
    })
    assert.ok(Date.parse(ahead.observedAt) <= Date.now())
    const run = await beginRun(ctx, start)
    assert.equal(run.observedAt, start.observedAt)
    assert.equal(
        runs().find((entry) => entry._id === run.id)?.startedRevision,
        "0"
    )
    // An older bot without the start still begins at the current revision.
    const legacy = await invoke(members.beginReconciliation, ctx, {
        secret,
        guildId: "guild-a",
        epoch,
    })
    assert.ok(legacy.id)
    // A newer epoch between the start and the begin: no run.
    await invoke(members.invalidateGuild, ctx, { secret, guildId: "guild-a" })
    assert.equal(await beginRun(ctx, start), null)
})

test("expired runs are pruned as single rows", async () => {
    const ctx = fixture()
    for (let i = 0; i < 3; i++)
        ctx.db.seed("membershipSyncRuns", {
            _id: `membershipSyncRuns:${i}`,
            guildId: "guild-a",
            epoch: "1",
            startedRevision: "0",
            observedAt: new Date().toISOString(),
            seenCount: 0,
            nextBatch: 0,
            status: "complete",
            cursor: null,
            expiresAt: i === 2 ? Date.now() + 60_000 : Date.now() - 1,
        })
    await invoke(members.pruneReconciliations, ctx)
    assert.deepEqual(
        ctx.db.tables.membershipSyncRuns.map((run) => run._id),
        ["membershipSyncRuns:2"]
    )
})

test("member access is written only when roles or access change", async () => {
    const ctx = fixture()
    const discord = await import("../../../convex/discordSync")
    const epoch = await invoke(members.ensureGuild, ctx, {
        secret,
        guildId: "guild-a",
    })
    const upsert = (roleIds: string[], isAdmin = false) =>
        invoke(discord.upsertMemberAccess, ctx, {
            secret: botSecret(),
            guildId: "guild-a",
            userId: "member-a",
            roleIds,
            isAdmin,
            hasDashboardAccess: isAdmin,
            observation: { epoch, observedAt: new Date().toISOString() },
        })
    const id = await upsert(["allowed", "other"])
    const { writes, restore } = countWrites(ctx)
    assert.equal(await upsert(["other", "allowed"]), id)
    assert.deepEqual(writes, { memberObservations: 1 }, "evidence only")
    restore()
    await upsert(["other", "allowed"], true)
    assert.equal(ctx.db.tables.discordMemberAccess[0].isAdmin, true)
    await upsert(["allowed"], true)
    assert.deepEqual(ctx.db.tables.discordMemberAccess[0].roleIds, ["allowed"])
})

test("the roles overview shows the last complete member sync, not the last access change", async () => {
    const ctx = fixture()
    const roleAccess = await import("../../../convex/roleAccess")
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "guild-a",
        adminIds: [],
        adminAccessOverrides: {},
    })
    const old = new Date(Date.now() - 86_400_000).toISOString()
    ctx.db.seed("discordMemberAccess", {
        _id: "discordMemberAccess:a",
        guildId: "guild-a",
        userId: "member-a",
        roleIds: ["allowed"],
        isAdmin: false,
        hasDashboardAccess: false,
        createdAt: old,
        updatedAt: old,
    })
    await invoke(members.ensureGuild, ctx, { secret, guildId: "guild-a" })
    const overview = () =>
        invoke(roleAccess.getOverview, ctx, {
            secret: botSecret(),
            serverId: "guilds:a",
        })
    assert.equal((await overview()).updatedAt, old)
    const { run } = await reconcile(ctx, [access("member-a", ["allowed"])])
    assert.equal(ctx.db.tables.discordMemberAccess[0].updatedAt, old)
    assert.equal((await overview()).updatedAt, run.observedAt)
})
