import * as commands from "../../../convex/websiteEventCommands"
import { testContext, invoke } from "./testing/database"
import { test, type TestContext } from "node:test"
import assert from "node:assert/strict"

const secret = "isolated-command-test-secret"
const subject = "123456789012345678"
const guildId = "223456789012345678"
const role = "323456789012345678"
const sid = "s".repeat(43)
const fields = {
    kind: "match" as const,
    name: "Synthetic three-faction friendly",
    map: "Synthetic Map",
    registrationEnd: "2030-01-01T17:00:00Z",
    meetingStart: "2030-01-01T18:00:00Z",
    gameStart: "2030-01-01T18:30:00Z",
    gameEnd: "2030-01-01T20:00:00Z",
}
const input = {
    secret,
    keyHash: "a".repeat(64),
    actorTokenHash: "b".repeat(64),
    gameId: "wardogs",
    idempotencyKey: "operation-one-0001",
    command: { operation: "create", event: fields },
}

function fixture(t: TestContext) {
    const previous = {
        secret: process.env.INTERNAL_AUTH_SECRET,
        enabled: process.env.LOGI_SSO_ENABLED,
    }
    process.env.INTERNAL_AUTH_SECRET = secret
    process.env.LOGI_SSO_ENABLED = "true"
    t.after(() => {
        if (previous.secret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous.secret
        if (previous.enabled === undefined) delete process.env.LOGI_SSO_ENABLED
        else process.env.LOGI_SSO_ENABLED = previous.enabled
    })
    let now = Date.now()
    t.mock.method(Date, "now", () => now)
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:actor",
        discordId: subject,
        name: "Synthetic actor",
        avatar: "",
        sessionVersion: 0,
    })
    ctx.db.seed("guilds", {
        _id: "guilds:one",
        discordId: guildId,
        enabledGames: ["wardogs", "hell_let_loose"],
        adminIds: [],
        memberIds: [],
        mercenaryIds: [],
    })
    ctx.db.seed("dashboardSessions", {
        _id: "dashboardSessions:one",
        sid,
        subject,
        userRecordId: "users:actor",
        userSessionVersion: 0,
        createdAt: now,
        expiresAt: now + 3600_000,
    })
    ctx.db.seed("ssoApplications", {
        _id: "ssoApplications:one",
        guildId: "guilds:one",
        clientId: "fixture-client",
        clientSecretHash: "c".repeat(64),
    })
    ctx.db.seed("ssoAccessTokens", {
        _id: "ssoAccessTokens:one",
        tokenHash: input.actorTokenHash,
        applicationRecordId: "ssoApplications:one",
        clientId: "fixture-client",
        clientSecretHash: "c".repeat(64),
        userId: subject,
        userRecordId: "users:actor",
        sessionId: sid,
        scope: "openid profile",
        expiresAt: now + 3600_000,
    })
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:one",
        guildId,
        keyHash: input.keyHash,
        readAccess: { resources: ["event-summaries"], gameIds: ["wardogs"] },
        writeAccess: { resources: ["event-commands"], gameIds: ["wardogs"] },
    })
    ctx.db.seed("websiteEventPolicies", {
        _id: "websiteEventPolicies:one",
        applicationRecordId: "ssoApplications:one",
        apiKeyId: "apiKeys:one",
        guildId,
        enabled: true,
        games: [{ gameId: "wardogs", roleIds: [role] }],
        version: "1",
        updatedBy: subject,
        updatedAt: new Date(now).toISOString(),
    })
    ctx.db.seed("membershipGuilds", {
        _id: "membershipGuilds:one",
        guildId,
        epoch: "3",
        revision: "10",
        epochRevision: "8",
    })
    ctx.db.seed("memberObservations", {
        _id: "memberObservations:one",
        guildId,
        discordUserId: subject,
        state: "present",
        roleIds: [role],
        observedAt: new Date(now).toISOString(),
        receivedAt: new Date(now).toISOString(),
        epoch: "3",
        revision: "10",
        unavailable: false,
    })
    return {
        ctx,
        advance: (ms: number) => {
            now += ms
        },
        run: (patch: Record<string, unknown> = {}) =>
            invoke(commands.execute, ctx, { ...input, ...patch }),
    }
}

test("actor command creates exactly one native event, schedules it and returns the committed change revision", async (t) => {
    const f = fixture(t)
    const result = await f.run()
    assert.equal(result.data.operation, "create")
    assert.equal(result.data.guildId, guildId)
    assert.equal(result.data.replayed, false)
    const event = f.ctx.db.tables.events[0]
    assert.equal(event.name, fields.name)
    assert.equal(event.gameId, "wardogs")
    assert.equal(event.guildId, guildId)
    assert.equal(event.pingClan, false)
    assert.equal(event.createForumChannel, false)
    assert.ok(f.ctx.db.tables.eventScheduleJobs.length > 0)
    const stamp = f.ctx.db.tables.integrationRecords.find(
        (row) => row.resource === "event-summaries"
    )
    assert.equal(result.data.revision, stamp!.revision)
    assert.deepEqual(
        f.ctx.db.tables.integrationChanges.map((row) => row.resource).sort(),
        ["event-summaries", "match-summaries", "result-summaries"]
    )
    const receipt = f.ctx.db.tables.websiteEventCommandReceipts[0]
    assert.equal(receipt.subject, subject)
    assert.equal(receipt.clientId, "fixture-client")
    assert.equal(receipt.eventId, event._id)
    assert.equal(receipt.bodyHash.length, 64)
    const retry = await f.run()
    assert.equal(retry.data.eventId, result.data.eventId)
    assert.equal(retry.data.receiptId, result.data.receiptId)
    assert.equal(retry.data.replayed, true)
    assert.equal(f.ctx.db.tables.events.length, 1)
    assert.equal(f.ctx.db.tables.websiteEventCommandReceipts.length, 1)
    assert.equal(f.ctx.db.tables.integrationChanges.length, 3)
})

test("same command key with changed body conflicts and foreign scope/actor cannot discover its receipt", async (t) => {
    const f = fixture(t)
    await f.run()
    assert.deepEqual(
        await f.run({
            command: {
                operation: "create",
                event: { ...fields, name: "Changed" },
            },
        }),
        { error: { code: "idempotency_conflict" } }
    )
    assert.deepEqual(await f.run({ gameId: "hell_let_loose" }), {
        error: { code: "insufficient_scope" },
    })
    assert.deepEqual(await f.run({ actorTokenHash: "d".repeat(64) }), {
        error: { code: "unauthorized" },
    })
    assert.equal(f.ctx.db.tables.events.length, 1)
})

for (const [name, table, patch, expected] of [
    [
        "central session revoked",
        "dashboardSessions",
        { revokedAt: 1 },
        "unauthorized",
    ],
    [
        "account generation changed",
        "users",
        { sessionVersion: 1 },
        "unauthorized",
    ],
    ["SSO token revoked", "ssoAccessTokens", { revokedAt: 1 }, "unauthorized"],
    [
        "app secret rotated",
        "ssoApplications",
        { clientSecretHash: "e".repeat(64) },
        "unauthorized",
    ],
    ["service key revoked", "apiKeys", { revokedAt: "now" }, "unauthorized"],
    [
        "write grant removed",
        "apiKeys",
        { writeAccess: undefined },
        "insufficient_scope",
    ],
    [
        "policy disabled",
        "websiteEventPolicies",
        { enabled: false },
        "policy_denied",
    ],
    [
        "policy app replaced",
        "websiteEventPolicies",
        { applicationRecordId: "ssoApplications:other" },
        "policy_denied",
    ],
    [
        "role removed",
        "memberObservations",
        { roleIds: [] },
        "membership_denied",
    ],
    [
        "member left",
        "memberObservations",
        { state: "left", roleIds: [] },
        "membership_denied",
    ],
    [
        "guild epoch changed",
        "membershipGuilds",
        { epoch: "4" },
        "membership_stale",
    ],
] as const)
    test(`receipt replay rechecks authority after ${name}`, async (t) => {
        const f = fixture(t)
        await f.run()
        Object.assign(f.ctx.db.tables[table][0], patch)
        assert.deepEqual(await f.run(), { error: { code: expected } })
        assert.equal(f.ctx.db.tables.events.length, 1)
    })

test("stale/future observations fail even when receivedAt is recent; no login/admin fallback", async (t) => {
    const f = fixture(t)
    f.advance(60_001)
    f.ctx.db.tables.memberObservations[0].receivedAt = new Date(
        Date.now()
    ).toISOString()
    f.ctx.db.tables.guilds[0].adminIds = [subject]
    assert.deepEqual(await f.run(), { error: { code: "membership_stale" } })
    f.ctx.db.tables.memberObservations[0].observedAt = new Date(
        Date.now() + 1000
    ).toISOString()
    assert.deepEqual(await f.run(), { error: { code: "membership_stale" } })
    assert.equal(f.ctx.db.tables.events?.length ?? 0, 0)
})

test("revision conflict prevents overwrite; update preserves private native Discord fields", async (t) => {
    const f = fixture(t)
    const created = await f.run()
    const event = f.ctx.db.tables.events[0]
    Object.assign(event, {
        serverPassword: "synthetic-private",
        announcementChannelId: "native-channel",
        requiredRoleIds: ["native-role"],
    })
    const update = {
        operation: "update",
        eventId: created.data.eventId,
        expectedRevision: "0",
        event: { ...fields, name: "Updated in web" },
    }
    assert.deepEqual(
        await f.run({ idempotencyKey: "update-command-0001", command: update }),
        { error: { code: "revision_conflict" } }
    )
    assert.equal(event.name, fields.name)
    const result = await f.run({
        idempotencyKey: "update-command-0001",
        command: { ...update, expectedRevision: created.data.revision },
    })
    assert.equal(result.data.operation, "update")
    assert.equal(f.ctx.db.tables.events.length, 1)
    assert.equal(event.name, "Updated in web")
    assert.equal(event.serverPassword, "synthetic-private")
    assert.equal(event.announcementChannelId, "native-channel")
    assert.deepEqual(event.requiredRoleIds, ["native-role"])
    assert.notEqual(result.data.revision, created.data.revision)
    const editor = await invoke(commands.readEditor, f.ctx, {
        secret,
        keyHash: input.keyHash,
        actorTokenHash: input.actorTokenHash,
        gameId: "wardogs",
        eventId: event._id,
    })
    assert.equal(editor.data.event.name, "Updated in web")
    assert.equal(editor.data.revision, result.data.revision)
    assert.equal(JSON.stringify(editor).includes("synthetic-private"), false)
    assert.equal(JSON.stringify(editor).includes("native-role"), false)
})

test("cancel uses existing pre-meeting conclusion, skips scores, clears pending schedule and emits a new revision", async (t) => {
    const f = fixture(t)
    const created = await f.run()
    const result = await f.run({
        idempotencyKey: "cancel-command-0001",
        command: {
            operation: "cancel",
            eventId: created.data.eventId,
            expectedRevision: created.data.revision,
        },
    })
    assert.equal(result.data.operation, "cancel")
    const event = f.ctx.db.tables.events[0]
    assert.equal(event.status, "concluded")
    assert.equal(event.scoreResolution, "skipped")
    assert.equal(f.ctx.db.tables.eventScheduleJobs.length, 0)
    assert.notEqual(result.data.revision, created.data.revision)
    assert.equal(event.eventResult, undefined)
})

test("final receipt failure rolls back native event, schedule and all emitted changes", async (t) => {
    const f = fixture(t)
    const insert = f.ctx.db.insert.bind(f.ctx.db)
    t.mock.method(
        f.ctx.db,
        "insert",
        async (table: string, value: Record<string, unknown>) => {
            if (table === "websiteEventCommandReceipts")
                throw new Error("synthetic transaction failure")
            return insert(table, value)
        }
    )
    await assert.rejects(f.run(), /transaction failure/)
    for (const table of [
        "events",
        "eventScheduleJobs",
        "integrationChanges",
        "integrationRecords",
        "websiteEventCommandReceipts",
    ])
        assert.equal(f.ctx.db.tables[table]?.length ?? 0, 0)
})

test("configuration requires a current dashboard admin and a restricted key; disabled policy removes write grant", async (t) => {
    const f = fixture(t)
    const args = {
        secret,
        sid,
        workspaceId: "guilds:one",
        applicationRecordId: "ssoApplications:one",
        apiKeyId: "apiKeys:one",
        policy: {
            enabled: true,
            games: [{ gameId: "wardogs", roleIds: [role] }],
        },
    }
    assert.deepEqual(await invoke(commands.configurePolicy, f.ctx, args), {
        error: { code: "policy_denied" },
    })
    f.ctx.db.tables.guilds[0].adminIds = [subject]
    assert.deepEqual(
        await invoke(commands.configurePolicy, f.ctx, {
            ...args,
            workspaceId: "guilds:foreign",
        }),
        { error: { code: "policy_denied" } }
    )
    assert.equal(
        (await invoke(commands.configurePolicy, f.ctx, args)).data.enabled,
        true
    )
    assert.equal(
        (
            await invoke(commands.configurePolicy, f.ctx, {
                ...args,
                policy: { ...args.policy, enabled: false },
            })
        ).data.enabled,
        false
    )
    assert.equal(f.ctx.db.tables.apiKeys[0].writeAccess, undefined)
    assert.deepEqual(await f.run(), { error: { code: "insufficient_scope" } })
    delete f.ctx.db.tables.apiKeys[0].readAccess
    assert.deepEqual(await invoke(commands.configurePolicy, f.ctx, args), {
        error: { code: "policy_denied" },
    })
})
