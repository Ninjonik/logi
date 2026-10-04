import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as teamRequests from "../../../convex/teamRequests"
import * as matchTeams from "../../../convex/matchTeams"
import { invoke, testContext } from "./testing/database"
import * as teamReads from "../../../convex/teamReads"
import * as teams from "../../../convex/teams"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "guild-a"
/** A workspace administrator of guild-a. */
const workspace = { secret, guildId, actor: actorFixture }
/** The same session attested as a global administrator by the gateway. */
const platform = { secret, actor: { ...actorFixture, superadmin: true } }
const key = "k".repeat(64)
const asset = (id: string, owner: string, letter: string) => ({
    _id: id,
    guildId: owner,
    kind: "team-logo",
    publicId: letter.repeat(32),
    storageId: `storage:${id}`,
    contentType: "image/png",
    width: 512,
    height: 512,
    bytes: 1000,
    sha256: "b".repeat(64),
    publicUrl: `https://logi.test/api/image-assets/${letter.repeat(32)}.png`,
    state: "ready",
    createdAt: "2026-10-01T00:00:00.000Z",
    createdBy: actorFixture.subject,
})

function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.tables.guilds[0].name = "Workspace A"
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:a",
        guildId,
        keyHash: key,
        readAccess: { resources: ["teams"], gameIds: ["hell_let_loose"] },
    })
    // Another workspace subscribed to Wardogs teams only, and one without the grant.
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:b",
        guildId: "guild-b",
        keyHash: "b".repeat(64),
        readAccess: { resources: ["teams"], gameIds: ["wardogs"] },
    })
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:c",
        guildId: "guild-c",
        keyHash: "c".repeat(64),
        readAccess: { resources: ["events"], gameIds: ["hell_let_loose"] },
    })
    ctx.db.seed("imageAssets", asset("imageAssets:platform", "platform", "a"))
    ctx.db.seed("imageAssets", asset("imageAssets:workspace", guildId, "c"))
    ctx.db.seed("imageAssets", asset("imageAssets:other", "guild-b", "d"))
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId,
        defaultLanguage: "cs",
    })
    return ctx
}
type Ctx = ReturnType<typeof setup>
const reader = (ctx: Ctx) =>
    ctx as unknown as Parameters<typeof matchTeams.resolveEventMatchTeams>[0]
const create = (ctx: Ctx, input: Record<string, unknown>) =>
    invoke(teams.create, ctx, { ...platform, input })

test("global administrators create catalogue teams idempotently and changes reach subscribed workspaces", async () => {
    const ctx = setup()
    const input = {
        gameId: "hell_let_loose",
        name: "  Valkyria ",
        shortCode: "VLK",
        logoAssetId: "imageAssets:platform",
        description: "Czech HLL clan",
        links: ["https://valkyria.example"],
        linkedGuildId: "123456789012345678",
        idempotencyKey: "create-valkyria-1",
    }
    const first = await create(ctx, input)
    assert.equal(first.ok, true)
    assert.deepEqual(await create(ctx, input), {
        ok: true,
        teamId: first.teamId,
        revision: 1,
        replayed: true,
    })
    assert.deepEqual(await create(ctx, { ...input, name: "Different" }), {
        error: "idempotency_conflict",
    })
    assert.deepEqual(
        await create(ctx, {
            gameId: "hell_let_loose",
            name: "VALKYRIA",
            idempotencyKey: "create-valkyria-2",
        }),
        { error: "duplicate_name", existingId: first.teamId }
    )
    // A workspace-owned upload is not a catalogue logo until a request is approved.
    assert.deepEqual(
        await create(ctx, {
            gameId: "wardogs",
            name: "Lonestar",
            logoAssetId: "imageAssets:workspace",
            idempotencyKey: "create-lonestar-1",
        }),
        { error: "asset_unavailable" }
    )
    const stored = ctx.db.tables.teamDirectory[0]
    assert.equal(stored.guildId, undefined)
    assert.equal(stored.description, "Czech HLL clan")
    assert.equal(stored.linkedGuildId, "123456789012345678")
    assert.equal(ctx.db.tables.teamDirectoryAudit[0].guildId, "platform")
    assert.deepEqual(
        ctx.db.tables.imageAssetReferences.map((row) => [
            row.owner,
            row.ownerId,
            row.guildId,
        ]),
        [["team", first.teamId, "platform"]]
    )
    // Only guild-a holds the HLL `teams` grant, so only its feed gets the change.
    assert.deepEqual(
        ctx.db.tables.integrationChanges.map((row) => [
            row.guildId,
            row.resource,
            row.operation,
        ]),
        [["guild-a", "teams", "upsert"]]
    )
    const wardogs = await create(ctx, {
        gameId: "wardogs",
        name: "Valkyria",
        idempotencyKey: "create-valkyria-3",
    })
    assert.equal(wardogs.ok, true)
    assert.equal(ctx.db.tables.integrationChanges.at(-1)?.guildId, "guild-b")
})

test("catalogue writes need a current superadmin session; workspace admins read active teams only", async () => {
    const ctx = setup()
    await assert.rejects(
        invoke(teams.create, ctx, {
            secret,
            actor: actorFixture,
            input: {
                gameId: "hell_let_loose",
                name: "Sneaky",
                idempotencyKey: "create-sneaky-1",
            },
        }),
        /Forbidden/
    )
    const created = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Alpha",
        idempotencyKey: "create-alpha-01",
    })
    await create(ctx, {
        gameId: "hell_let_loose",
        name: "Bravo",
        idempotencyKey: "create-bravo-01",
    })
    await invoke(teams.archive, ctx, {
        ...platform,
        teamId: created.teamId,
        input: { expectedRevision: 1 },
    })
    const active = await invoke(teams.list, ctx, {
        ...workspace,
        gameId: "hell_let_loose",
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        active.items.map((item: { name: string }) => item.name),
        ["Bravo"]
    )
    const all = await invoke(teams.adminList, ctx, {
        ...platform,
        gameId: "hell_let_loose",
        archived: true,
        cursor: null,
        limit: 50,
    })
    assert.equal(all.items.length, 2)
    const found = await invoke(teams.list, ctx, {
        ...workspace,
        gameId: "hell_let_loose",
        search: "bra",
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        found.items.map((item: { name: string }) => item.name),
        ["Bravo"]
    )
    // History stays readable for an archived team.
    const archived = await invoke(teams.get, ctx, {
        ...workspace,
        teamId: created.teamId,
    })
    assert.ok(archived.archivedAt)
    await assert.rejects(
        invoke(teams.list, ctx, {
            ...workspace,
            guildId: "guild-z",
            gameId: "hell_let_loose",
            cursor: null,
            limit: 50,
        }),
        /Forbidden/
    )
    ctx.db.tables.dashboardSessions[0].revokedAt = Date.now()
    await assert.rejects(
        invoke(teams.adminList, ctx, {
            ...platform,
            gameId: "hell_let_loose",
            archived: false,
            cursor: null,
            limit: 50,
        }),
        /Forbidden/
    )
})

test("merge archives the duplicate, moves registrations, fixtures and pending requests, and frees the name", async () => {
    const ctx = setup()
    const dup = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Valkyria",
        idempotencyKey: "create-dup-0001",
    })
    const main = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Valkyria CZ",
        idempotencyKey: "create-main-001",
    })
    ctx.db.seed("competitions", {
        _id: "competitions:ecl",
        gameId: "hell_let_loose",
    })
    ctx.db.seed("competitionTeams", {
        _id: "competitionTeams:dup",
        competitionId: "competitions:ecl",
        teamId: dup.teamId,
        withdrawn: false,
    })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:1",
        competitionId: "competitions:ecl",
        sideATeamId: dup.teamId,
        sideBTeamId: "teamDirectory:other",
        status: "scheduled",
    })
    const pending = await invoke(teamRequests.submit, ctx, {
        ...workspace,
        input: {
            kind: "update",
            teamId: dup.teamId,
            proposal: { name: "Valkyria" },
            idempotencyKey: "change-dup-0001",
        },
    })
    assert.equal(pending.ok, true)
    assert.deepEqual(
        await invoke(teams.merge, ctx, {
            ...platform,
            teamId: dup.teamId,
            input: {
                expectedRevision: 1,
                targetTeamId: main.teamId,
                targetRevision: 1,
            },
        }),
        { ok: true, revision: 2, targetRevision: 2 }
    )
    const merged = ctx.db.tables.teamDirectory.find(
        (row) => row._id === dup.teamId
    )!
    assert.equal(merged.mergedIntoTeamId, main.teamId)
    assert.ok(merged.archivedAt)
    assert.equal(ctx.db.tables.competitionTeams[0].teamId, main.teamId)
    assert.equal(ctx.db.tables.competitionFixtures[0].sideATeamId, main.teamId)
    assert.equal(ctx.db.tables.teamRequests[0].teamId, main.teamId)
    assert.deepEqual(
        ctx.db.tables.integrationChanges
            .slice(-2)
            .map((row) => [row.id, row.operation]),
        [
            [dup.teamId, "remove"],
            [main.teamId, "upsert"],
        ]
    )
    // A merged team cannot come back, and its name is free again.
    assert.deepEqual(
        await invoke(teams.restore, ctx, {
            ...platform,
            teamId: dup.teamId,
            input: { expectedRevision: 2 },
        }),
        { error: "invalid_merge" }
    )
    const again = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Valkyria",
        idempotencyKey: "create-again-01",
    })
    assert.equal(again.ok, true)
})

test("website reads list the global catalogue for the granted game only", async () => {
    const ctx = setup()
    const created = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Valkyria",
        logoAssetId: "imageAssets:platform",
        idempotencyKey: "create-valkyria-1",
    })
    const credentials = {
        secret,
        keyHash: key,
        guildId,
        gameId: "hell_let_loose",
    }
    const page = await invoke(teamReads.list, ctx, {
        ...credentials,
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(page.items, [
        {
            id: created.teamId,
            gameId: "hell_let_loose",
            name: "Valkyria",
            shortCode: null,
            logoUrl: ctx.db.tables.imageAssets[0].publicUrl,
            description: null,
            links: [],
            revision: 1,
            updatedAt: ctx.db.tables.teamDirectory[0].updatedAt,
        },
    ])
    assert.equal(
        await invoke(teamReads.list, ctx, {
            ...credentials,
            gameId: "wardogs",
            cursor: null,
            limit: 50,
        }),
        null
    )
    // The key must belong to the workspace that authenticated the request.
    assert.equal(
        await invoke(teamReads.list, ctx, {
            ...credentials,
            guildId: "guild-b",
            cursor: null,
            limit: 50,
        }),
        null
    )
    ctx.db.tables.apiKeys[0].readAccess = undefined
    assert.equal(
        await invoke(teamReads.list, ctx, {
            ...credentials,
            cursor: null,
            limit: 50,
        }),
        null,
        "legacy keys never acquire the teams resource"
    )
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: ["teams"],
        gameIds: ["hell_let_loose"],
    }
    await invoke(teams.archive, ctx, {
        ...platform,
        teamId: created.teamId,
        input: { expectedRevision: 1 },
    })
    assert.deepEqual(
        await invoke(teamReads.get, ctx, {
            ...credentials,
            id: created.teamId,
        }),
        { team: null }
    )
})

test("any workspace selects active catalogue teams; saved snapshots survive renames and archival", async () => {
    const ctx = setup()
    const a = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Alpha",
        logoAssetId: "imageAssets:platform",
        idempotencyKey: "create-alpha-01",
    })
    const b = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Bravo",
        idempotencyKey: "create-bravo-01",
    })
    const w = await create(ctx, {
        gameId: "wardogs",
        name: "Wolf",
        idempotencyKey: "create-wolf-001",
    })
    const base = {
        gameId: "hell_let_loose",
        kind: "match" as const,
        status: "registration" as const,
        previous: undefined,
        now: "2026-10-04T12:00:00.000Z",
    }
    const resolved = await matchTeams.resolveEventMatchTeams(reader(ctx), {
        ...base,
        inputs: [
            { teamId: a.teamId, slot: "a", side: "Allies" },
            { teamId: b.teamId, slot: "b", side: null },
        ],
    })
    assert.ok(resolved.ok)
    assert.equal(resolved.matchTeams?.[0]?.snapshot.name, "Alpha")
    assert.equal(
        resolved.matchTeams?.[0]?.snapshot.logoAssetId,
        "imageAssets:platform"
    )
    for (const [teamId, error] of [
        [w.teamId, "team_game_mismatch"],
        ["teamDirectory:nope", "team_not_found"],
    ])
        assert.deepEqual(
            await matchTeams.resolveEventMatchTeams(reader(ctx), {
                ...base,
                inputs: [{ teamId, slot: "a", side: null }],
            }),
            { ok: false, error }
        )
    await invoke(teams.update, ctx, {
        ...platform,
        teamId: a.teamId,
        input: { expectedRevision: 1, name: "Alpha Renamed" },
    })
    await invoke(teams.archive, ctx, {
        ...platform,
        teamId: a.teamId,
        input: { expectedRevision: 2 },
    })
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            inputs: undefined,
            previous: resolved.matchTeams,
        }),
        { ok: true, matchTeams: resolved.matchTeams }
    )
    const moved = await matchTeams.resolveEventMatchTeams(reader(ctx), {
        ...base,
        inputs: [{ teamId: a.teamId, slot: "b", side: "Axis" }],
        previous: resolved.matchTeams,
    })
    assert.ok(moved.ok)
    assert.equal(moved.matchTeams?.[0]?.snapshot.name, "Alpha")
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            inputs: [{ teamId: a.teamId, slot: "a", side: null }],
        }),
        { ok: false, error: "team_archived" }
    )
})

test("a dashboard refresh follows a merge pointer and audits the replacement", async () => {
    const ctx = setup()
    const old = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Old Name",
        idempotencyKey: "create-old-0001",
    })
    const now = "2030-01-01T00:00:00.000Z"
    const resolved = await matchTeams.resolveEventMatchTeams(reader(ctx), {
        gameId: "hell_let_loose",
        kind: "match",
        status: "registration",
        inputs: [{ teamId: old.teamId, slot: "a", side: null }],
        previous: undefined,
        now,
    })
    assert.ok(resolved.ok)
    ctx.db.seed("events", {
        _id: "events:match",
        guildId,
        gameId: "hell_let_loose",
        kind: "match",
        status: "registration",
        name: "Match",
        registrationEnd: "2030-01-01T17:00:00.000Z",
        meetingStart: "2030-01-01T18:00:00.000Z",
        gameStart: "2030-01-01T18:30:00.000Z",
        gameEnd: "2030-01-01T20:00:00.000Z",
        pingClan: false,
        createdAt: now,
        matchTeams: resolved.matchTeams,
    })
    const replacement = await create(ctx, {
        gameId: "hell_let_loose",
        name: "New Name",
        logoAssetId: "imageAssets:platform",
        idempotencyKey: "create-new-0001",
    })
    await invoke(teams.merge, ctx, {
        ...platform,
        teamId: old.teamId,
        input: {
            expectedRevision: 1,
            targetTeamId: replacement.teamId,
            targetRevision: 1,
        },
    })
    const refreshed = await invoke(matchTeams.refreshSnapshot, ctx, {
        secret,
        serverId: "guilds:admin",
        eventId: "events:match",
        teamId: old.teamId,
        actor: actorFixture,
    })
    assert.equal(refreshed.ok, true)
    const stored = ctx.db.tables.events[0].matchTeams[0]
    assert.equal(stored.teamId, replacement.teamId)
    assert.equal(stored.snapshot.name, "New Name")
    assert.ok(
        ctx.db.tables.imageAssetReferences.some(
            (row) => row.owner === "event" && row.ownerId === "events:match"
        )
    )
    const audit = ctx.db.tables.teamDirectoryAudit.at(-1)
    assert.equal(audit?.operation, "snapshot_refresh")
    assert.equal(audit?.teamId, replacement.teamId)
})

test("an approved request creates the team, moves its logo to the platform and queues one DM", async () => {
    const ctx = setup()
    const submitted = await invoke(teamRequests.submit, ctx, {
        ...workspace,
        input: {
            kind: "create",
            gameId: "hell_let_loose",
            proposal: {
                name: "Valkyria",
                shortCode: "VLK",
                logoAssetId: "imageAssets:workspace",
                links: ["https://valkyria.example"],
            },
            note: "Our team",
            idempotencyKey: "request-key-0001",
        },
    })
    assert.equal(submitted.ok, true)
    assert.deepEqual(
        await invoke(teamRequests.submit, ctx, {
            ...workspace,
            input: {
                kind: "create",
                gameId: "hell_let_loose",
                proposal: {
                    name: "Foreign logo",
                    logoAssetId: "imageAssets:other",
                },
                idempotencyKey: "request-key-0002",
            },
        }),
        { error: "asset_unavailable" }
    )
    assert.deepEqual(
        ctx.db.tables.imageAssetReferences.map((row) => [
            row.owner,
            row.guildId,
        ]),
        [["teamRequest", guildId]]
    )
    const mine = await invoke(teamRequests.listMine, ctx, {
        ...workspace,
        cursor: null,
        limit: 20,
    })
    assert.equal(mine.items[0].status, "pending")
    assert.equal(mine.items[0].workspaceName, "Workspace A")
    // Workspace administrators cannot decide; global administrators can.
    await assert.rejects(
        invoke(teamRequests.decide, ctx, {
            secret,
            actor: actorFixture,
            requestId: submitted.requestId,
            input: { decision: "approve" },
        }),
        /Forbidden/
    )
    const queue = await invoke(teamRequests.queue, ctx, {
        ...platform,
        status: "pending",
        cursor: null,
        limit: 20,
    })
    assert.equal(queue.items.length, 1)
    assert.equal(
        queue.items[0].proposal.logoUrl,
        ctx.db.tables.imageAssets[1].publicUrl
    )
    const decided = await invoke(teamRequests.decide, ctx, {
        ...platform,
        requestId: submitted.requestId,
        input: {
            decision: "approve",
            proposal: {
                name: "Valkyria CZ",
                shortCode: "VLK",
                logoAssetId: "imageAssets:workspace",
                links: ["https://valkyria.example"],
            },
        },
    })
    assert.equal(decided.ok, true)
    const team = ctx.db.tables.teamDirectory.find(
        (row) => row._id === decided.teamId
    )!
    assert.equal(team.name, "Valkyria CZ")
    assert.equal(team.logoAssetId, "imageAssets:workspace")
    assert.equal(
        ctx.db.tables.imageAssets.find(
            (row) => row._id === "imageAssets:workspace"
        )!.guildId,
        "platform"
    )
    assert.deepEqual(
        ctx.db.tables.imageAssetReferences.map((row) => [
            row.owner,
            row.guildId,
        ]),
        [["team", "platform"]]
    )
    const request = ctx.db.tables.teamRequests[0]
    assert.equal(request.status, "approved")
    assert.equal(request.resultTeamId, decided.teamId)
    assert.equal(request.notificationStatus, "pending")
    assert.equal(
        ctx.db.tables.teamDirectoryAudit.at(-1)?.requestId,
        submitted.requestId
    )
})

test("decision DMs are leased, retried with backoff and marked failed after the last attempt", async (t) => {
    let now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    const submitted = await invoke(teamRequests.submit, ctx, {
        ...workspace,
        input: {
            kind: "create",
            gameId: "wardogs",
            proposal: { name: "Lonestar" },
            idempotencyKey: "request-key-0001",
        },
    })
    await invoke(teamRequests.decide, ctx, {
        ...platform,
        requestId: submitted.requestId,
        input: { decision: "reject", reason: "Duplicate of an existing team" },
    })
    await assert.rejects(
        invoke(teamRequests.claimNotifications, ctx, { secret: "wrong" }),
        /Unauthorized/
    )
    const claimed = await invoke(teamRequests.claimNotifications, ctx, {
        secret,
    })
    assert.deepEqual(claimed, [
        {
            requestId: submitted.requestId,
            discordUserId: actorFixture.subject,
            guildId,
            language: "cs",
            kind: "create",
            gameId: "wardogs",
            status: "rejected",
            requestedName: "Lonestar",
            teamName: null,
            reason: "Duplicate of an existing team",
        },
    ])
    // The lease hides the claim from a second pass.
    assert.deepEqual(
        await invoke(teamRequests.claimNotifications, ctx, { secret }),
        []
    )
    for (let attempt = 1; attempt <= 4; attempt++) {
        await invoke(teamRequests.markNotified, ctx, {
            secret,
            requestId: submitted.requestId,
            outcome: "failed",
        })
        assert.equal(
            ctx.db.tables.teamRequests[0].notificationStatus,
            "pending"
        )
        now = ctx.db.tables.teamRequests[0].notificationNextAttemptAt
        assert.equal(
            (await invoke(teamRequests.claimNotifications, ctx, { secret }))
                .length,
            1
        )
    }
    await invoke(teamRequests.markNotified, ctx, {
        secret,
        requestId: submitted.requestId,
        outcome: "failed",
    })
    assert.equal(ctx.db.tables.teamRequests[0].notificationStatus, "failed")
    assert.equal(ctx.db.tables.teamRequests[0].notificationAttempts, 5)
})

test("cancel is limited to the requesting workspace and a sent DM is recorded once", async () => {
    const ctx = setup()
    const submitted = await invoke(teamRequests.submit, ctx, {
        ...workspace,
        input: {
            kind: "create",
            gameId: "hell_let_loose",
            proposal: { name: "Charlie" },
            idempotencyKey: "request-key-0001",
        },
    })
    ctx.db.tables.teamRequests[0].guildId = "guild-b"
    assert.deepEqual(
        await invoke(teamRequests.cancel, ctx, {
            ...workspace,
            requestId: submitted.requestId,
        }),
        { error: "not_found" }
    )
    ctx.db.tables.teamRequests[0].guildId = guildId
    assert.deepEqual(
        await invoke(teamRequests.cancel, ctx, {
            ...workspace,
            requestId: submitted.requestId,
        }),
        { ok: true }
    )
    assert.equal(ctx.db.tables.teamRequests[0].notificationStatus, "none")
    const second = await invoke(teamRequests.submit, ctx, {
        ...workspace,
        input: {
            kind: "create",
            gameId: "hell_let_loose",
            proposal: { name: "Delta" },
            idempotencyKey: "request-key-0002",
        },
    })
    await invoke(teamRequests.decide, ctx, {
        ...platform,
        requestId: second.requestId,
        input: { decision: "approve" },
    })
    assert.deepEqual(
        await invoke(teamRequests.markNotified, ctx, {
            secret,
            requestId: second.requestId,
            outcome: "sent",
        }),
        { ok: true }
    )
    assert.equal(ctx.db.tables.teamRequests[1].notificationStatus, "sent")
    assert.deepEqual(
        await invoke(teamRequests.markNotified, ctx, {
            secret,
            requestId: second.requestId,
            outcome: "failed",
        }),
        { ok: false }
    )
})

test("an unrecorded DM outcome is retried a bounded number of times; closed DMs are final", async (t) => {
    let now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    const decided = []
    for (const key of ["request-key-0101", "request-key-0102"]) {
        const submitted = await invoke(teamRequests.submit, ctx, {
            ...workspace,
            input: {
                kind: "create",
                gameId: "wardogs",
                proposal: { name: `Team ${key}` },
                idempotencyKey: key,
            },
        })
        await invoke(teamRequests.decide, ctx, {
            ...platform,
            requestId: submitted.requestId,
            input: { decision: "reject", reason: "Not a team" },
        })
        decided.push(submitted.requestId)
    }
    // The bot sends but never manages to record the outcome: each lease expires.
    for (let claim = 1; claim <= 5; claim++) {
        assert.equal(
            (await invoke(teamRequests.claimNotifications, ctx, { secret }))
                .length,
            claim === 1 ? 2 : 1
        )
        if (claim === 1)
            await invoke(teamRequests.markNotified, ctx, {
                secret,
                requestId: decided[1],
                outcome: "undeliverable",
            })
        now += 3 * 60_000
    }
    assert.deepEqual(
        await invoke(teamRequests.claimNotifications, ctx, { secret }),
        []
    )
    const [first, second] = ctx.db.tables.teamRequests
    assert.equal(first.notificationStatus, "failed")
    assert.equal(first.notificationAttempts, 5)
    assert.equal(second.notificationStatus, "failed")
    assert.equal(second.notificationAttempts, 1)
})

test("the bot endpoints refuse everything when no internal secret is configured", async (t) => {
    const ctx = setup()
    const previous = process.env.INTERNAL_AUTH_SECRET
    delete process.env.INTERNAL_AUTH_SECRET
    t.after(() => {
        process.env.INTERNAL_AUTH_SECRET = previous
    })
    for (const candidate of ["", "dev-internal-auth-secret"])
        await assert.rejects(
            invoke(teamRequests.claimNotifications, ctx, {
                secret: candidate,
            }),
            /Unauthorized/
        )
})
