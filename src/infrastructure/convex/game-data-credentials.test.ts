import {
    credentialAad,
    gameServerSourceSchema,
    type CredentialBinding,
} from "../../domain/game-data/credentials"
import {
    migrateLegacyCredentials,
    reencryptCredentials,
} from "../../application/game-data/migrate-credentials"
import {
    decryptCredential,
    encryptCredential,
    parseKeyring,
} from "../game-data/credential-cipher"
import * as migration from "../../../convex/gameDataCredentialMigration"
import * as credentials from "../../../convex/gameDataCredentials"
import * as sources from "../../../convex/gameDataSources"
import { actorFixture } from "./testing/dashboard-actor"
import { invoke, testContext } from "./testing/database"
import * as gameData from "../../../convex/gameData"
import test, { type TestContext } from "node:test"
import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"

const SENTINEL = "sentinel-provider-key-9b14d7e2"
const secret = "dev-internal-auth-secret"
const k1 = randomBytes(32).toString("base64")
const k2 = randomBytes(32).toString("base64")
const ring1 = JSON.stringify({ current: "k1", keys: { k1 } })
const warconId = "11111111-1111-4111-8111-111111111111"
const refA = "src-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const refB = "src-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
const draft = {
    displayName: "Valkyria Warcon",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    origin: "https://wardogs.example.test",
    providerServerId: warconId,
}
const access = (guildId: string) => ({ secret, guildId, actor: actorFixture })

function setEnv(t: TestContext, values: Record<string, string | undefined>) {
    for (const [name, value] of Object.entries(values)) {
        const previous = process.env[name]
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
        t.after(() => {
            if (previous === undefined) delete process.env[name]
            else process.env[name] = previous
        })
    }
}

/** Two workspaces with the same synthetic administrator. */
function setup(t: TestContext, operator: unknown[] = []) {
    setEnv(t, {
        INTERNAL_AUTH_SECRET: secret,
        LOGI_CREDENTIAL_KEYRING: ring1,
        LOGI_GAME_DATA_SOURCES: JSON.stringify(operator),
    })
    const ctx = testContext()
    ctx.db.tables.users = [
        {
            _id: actorFixture.userRecordId,
            discordId: actorFixture.subject,
            sessionVersion: 0,
        },
    ]
    ctx.db.tables.dashboardSessions = [
        {
            _id: "sessions:admin",
            sid: actorFixture.sid,
            subject: actorFixture.subject,
            userRecordId: actorFixture.userRecordId,
            userSessionVersion: 0,
            expiresAt: Date.now() + 3_600_000,
            createdAt: Date.now(),
        },
    ]
    ctx.db.tables.guilds = []
    ctx.db.tables.discordMemberAccess = []
    for (const guildId of ["guild-a", "guild-b"]) admin(ctx, guildId)
    return ctx
}
function admin(ctx: ReturnType<typeof testContext>, guildId: string) {
    ctx.db.tables.guilds!.push({
        _id: `guilds:${guildId}`,
        discordId: guildId,
        adminIds: [],
    })
    ctx.db.tables.discordMemberAccess!.push({
        _id: `access:${guildId}`,
        guildId,
        userId: actorFixture.subject,
        isAdmin: true,
        hasDashboardAccess: true,
    })
}
function envelopeFor(binding: CredentialBinding, key = SENTINEL, ring = ring1) {
    return encryptCredential(parseKeyring(ring)!, key, credentialAad(binding))
}
const bindingOf = (guildId: string, sourceRef: string) => ({
    guildId,
    sourceRef,
    provider: "wardogs_warcon" as const,
    origin: "https://wardogs.example.test",
    providerServerId: warconId,
})
async function create(
    ctx: ReturnType<typeof testContext>,
    guildId: string,
    ref: string,
    overrides: Record<string, unknown> = {}
) {
    return invoke(sources.create, ctx, {
        ...access(guildId),
        source: { ...draft, ref },
        credential: envelopeFor(bindingOf(guildId, ref)),
        verified: true,
        testOutcome: "ok",
        enable: true,
        ...overrides,
    })
}
const connectionOf = (ctx: ReturnType<typeof testContext>, ref: string) =>
    ctx.db.tables.gameDataConnections!.find((row) => row.sourceRef === ref)!
function leaks(value: unknown) {
    const text = JSON.stringify(value)
    return (
        text.includes(SENTINEL) ||
        text.includes(Buffer.from(SENTINEL).toString("base64")) ||
        text.includes(k1) ||
        text.includes(k2)
    )
}

test("a new source stores only ciphertext; the list is an explicit projection", async (t) => {
    const ctx = setup(t)
    const logs: unknown[] = []
    for (const method of ["log", "info", "warn", "error", "debug"] as const)
        t.mock.method(console, method, (...args: unknown[]) => logs.push(args))
    assert.deepEqual(await create(ctx, "guild-a", refA, { enable: false }), {
        ok: true,
        ref: refA,
        revision: 1,
        enabled: false,
    })
    const stored = ctx.db.tables.gameDataCredentials![0]!
    assert.equal(stored.keyId, "k1")
    assert.equal(
        decryptCredential(
            parseKeyring(ring1),
            {
                format: 1,
                keyId: stored.keyId,
                nonce: stored.nonce,
                ciphertext: stored.ciphertext,
                tag: stored.tag,
            },
            credentialAad(bindingOf("guild-a", refA))
        ),
        SENTINEL
    )
    const list = await invoke(sources.list, ctx, access("guild-a"))
    const [source] = list.sources
    assert.deepEqual(gameServerSourceSchema.parse(source), source)
    assert.deepEqual(Object.keys(source).sort(), [
        "collection",
        "displayName",
        "gameId",
        "key",
        "lastTest",
        "managed",
        "origin",
        "provider",
        "providerServerId",
        "ref",
        "revision",
    ])
    for (const field of ["ciphertext", "nonce", "tag", "keyId", "secretRef"])
        assert.equal(JSON.stringify(list).includes(field), false, field)
    assert.deepEqual(source.key, {
        state: "set",
        changedAt: stored.updatedAt,
        verified: true,
        failure: null,
    })
    assert.equal(source.collection.enabled, false)
    assert.equal(leaks(ctx.db.tables), false)
    assert.equal(leaks(list), false)
    assert.equal(leaks(logs), false)
})

test("collection starts only from a verified key and the provider rules", async (t) => {
    const ctx = setup(t)
    assert.deepEqual(await create(ctx, "guild-a", refA, { verified: false }), {
        error: "verification_required",
    })
    assert.deepEqual(await create(ctx, "guild-a", refA, { credential: null }), {
        error: "key_required",
    })
    assert.deepEqual(
        await invoke(sources.create, ctx, {
            ...access("guild-a"),
            source: {
                ...draft,
                ref: refA,
                provider: "wardogs_public_directory",
                origin: "https://api.wardogservers.com",
                providerServerId: "123",
            },
            credential: envelopeFor(bindingOf("guild-a", refA)),
            verified: true,
            testOutcome: "ok",
            enable: false,
        }),
        { error: "key_not_allowed" }
    )
    // A ciphertext under a key this deployment does not hold is never stored.
    assert.deepEqual(
        await create(ctx, "guild-a", refA, {
            credential: envelopeFor(
                bindingOf("guild-a", refA),
                SENTINEL,
                JSON.stringify({ current: "k9", keys: { k9: k2 } })
            ),
        }),
        { error: "encryption_unavailable" }
    )
    assert.equal(ctx.db.tables.gameDataSources?.length ?? 0, 0)
    assert.equal(ctx.db.tables.gameDataCredentials?.length ?? 0, 0)
    // An unverified draft cannot be enabled from the dashboard.
    await create(ctx, "guild-a", refA, { verified: false, enable: false })
    await assert.rejects(
        invoke(gameData.configureForDashboard, ctx, {
            ...access("guild-a"),
            sourceRef: refA,
            enabled: true,
        }),
        /Test the stored key/
    )
    assert.equal(connectionOf(ctx, refA).enabled, false)
})

test("aliases are unique per workspace; references and identities stay scoped", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    assert.deepEqual(
        await create(ctx, "guild-a", refB, {
            source: { ...draft, ref: refB, displayName: " valkyria  WARCON " },
        }),
        { error: "duplicate_name" }
    )
    assert.deepEqual(
        await create(ctx, "guild-a", refB, {
            source: { ...draft, ref: refB, displayName: "Second" },
            credential: envelopeFor(bindingOf("guild-a", refB)),
        }),
        { error: "duplicate_identity" }
    )
    // Another workspace may use the same alias and server.
    assert.equal(
        (
            await create(ctx, "guild-b", refB, {
                credential: envelopeFor(bindingOf("guild-b", refB)),
            })
        ).ok,
        true
    )
    // A generated reference can never be reused, even by another workspace.
    assert.deepEqual(
        await create(ctx, "guild-b", refA, {
            source: {
                ...draft,
                ref: refA,
                displayName: "Other",
                providerServerId: "22222222-2222-4222-8222-222222222222",
            },
            credential: envelopeFor({
                ...bindingOf("guild-b", refA),
                providerServerId: "22222222-2222-4222-8222-222222222222",
            }),
        }),
        { error: "invalid_source" }
    )
    for (const ref of ["valkyria", "src-XYZ", "LOGI_GAME_DATA_X_TOKEN"])
        assert.deepEqual(
            await create(ctx, "guild-a", ref, {
                source: { ...draft, ref, displayName: ref },
            }),
            { error: "invalid_source" }
        )
})

test("knowing another workspace's reference is never enough", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    const before = structuredClone(ctx.db.tables)
    const as = (extra: Record<string, unknown>) => ({
        ...access("guild-b"),
        ref: refA,
        expectedRevision: 1,
        ...extra,
    })
    assert.deepEqual(
        await invoke(
            sources.setCredential,
            ctx,
            as({
                binding: {
                    provider: "wardogs_warcon",
                    origin: "https://wardogs.example.test",
                    providerServerId: warconId,
                },
                credential: envelopeFor(bindingOf("guild-b", refA)),
                verified: true,
                testOutcome: "ok",
            })
        ),
        { error: "not_found" }
    )
    assert.deepEqual(await invoke(sources.removeCredential, ctx, as({})), {
        error: "not_found",
    })
    assert.deepEqual(await invoke(sources.remove, ctx, as({})), {
        error: "not_found",
    })
    assert.deepEqual(
        await invoke(sources.rename, ctx, as({ displayName: "Mine" })),
        { error: "not_found" }
    )
    assert.deepEqual(
        await invoke(sources.reserveTest, ctx, {
            ...access("guild-b"),
            ref: refA,
        }),
        { error: "not_found" }
    )
    assert.deepEqual(
        await invoke(sources.reserveStoredTest, ctx, {
            ...access("guild-b"),
            ref: refA,
        }),
        { error: "not_found" }
    )
    await assert.rejects(
        invoke(gameData.configureForDashboard, ctx, {
            ...access("guild-b"),
            sourceRef: refA,
            enabled: false,
        }),
        /not found/
    )
    assert.deepEqual(
        (await invoke(sources.list, ctx, access("guild-b"))).sources,
        []
    )
    assert.deepEqual(ctx.db.tables.gameDataSources, before.gameDataSources)
    assert.deepEqual(
        ctx.db.tables.gameDataCredentials,
        before.gameDataCredentials
    )
    // A workspace administrator of B is not an administrator of A.
    ctx.db.tables.discordMemberAccess =
        ctx.db.tables.discordMemberAccess!.filter(
            (row) => row.guildId !== "guild-a"
        )
    await assert.rejects(
        invoke(sources.list, ctx, access("guild-a")),
        /Forbidden/
    )
})

test("the 201st and later sources resolve by index, not by a global scan", async (t) => {
    const ctx = setup(t)
    const total = 250
    for (let i = 0; i < total; i++) {
        const guildId = `guild-${String(Math.floor(i / 10)).padStart(3, "0")}`
        const ref = `src-${i.toString(16).padStart(32, "0")}`
        if (i % 10 === 0) admin(ctx, guildId)
        await invoke(sources.create, ctx, {
            ...access(guildId),
            source: {
                ...draft,
                ref,
                displayName: `Server ${i}`,
                providerServerId: `11111111-1111-4111-8111-${i.toString(16).padStart(12, "0")}`,
            },
            credential: envelopeFor({
                ...bindingOf(guildId, ref),
                providerServerId: `11111111-1111-4111-8111-${i.toString(16).padStart(12, "0")}`,
            }),
            verified: true,
            testOutcome: "ok",
            enable: true,
        })
    }
    assert.equal(ctx.db.tables.gameDataSources!.length, total)
    const lastRef = `src-${(total - 1).toString(16).padStart(32, "0")}`
    for (const row of ctx.db.tables.gameDataConnections!)
        row.nextAttemptAt =
            row.sourceRef === lastRef ? 1 : Date.parse("2100-01-01T00:00:00Z")
    const claim = await invoke(gameData.claimNext, ctx)
    assert.equal(claim.ref, lastRef)
    assert.equal(claim.guildId, "guild-024")
    assert.equal(claim.credentialMode, "encrypted")
    assert.equal(leaks(claim), false)
    const envelope = await invoke(credentials.envelope, ctx, {
        connectionId: claim.id,
        generation: claim.generation,
    })
    assert.equal(envelope.keyId, "k1")
    const listed = await invoke(sources.list, ctx, access("guild-024"))
    assert.equal(listed.sources.length, 10)
    assert.equal(
        listed.sources.every(
            (source: { managed: string }) => source.managed === "workspace"
        ),
        true
    )
})

test("a key change fences in-flight runs and caches; history keeps its progress", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    const connection = connectionOf(ctx, refA)
    const run = ctx.db.tables.gameDataHistoryRuns!.find(
        (row) => row.connectionId === connection._id
    )!
    run.progress = { page: 7, pendingIds: ["42"], nextPage: 8 }
    connection.nextAttemptAt = 1
    const claim = await invoke(gameData.claimNext, ctx)
    assert.equal(claim.generation, connection.generation)
    const rotated = await invoke(sources.setCredential, ctx, {
        ...access("guild-a"),
        ref: refA,
        expectedRevision: 1,
        binding: {
            provider: "wardogs_warcon",
            origin: "https://wardogs.example.test",
            providerServerId: warconId,
        },
        credential: envelopeFor(bindingOf("guild-a", refA), "rotated-key-001"),
        verified: true,
        testOutcome: "ok",
    })
    assert.deepEqual(rotated, { ok: true, revision: 2, enabled: true })
    assert.equal(connection.generation, claim.generation + 1)
    assert.equal(connection.leaseUntil, 0)
    assert.deepEqual(run.progress, { page: 7, pendingIds: ["42"], nextPage: 8 })
    assert.equal(run.leaseUntil, 0)
    // The stale worker can neither read the new key nor write its result.
    assert.equal(
        await invoke(credentials.envelope, ctx, {
            connectionId: claim.id,
            generation: claim.generation,
        }),
        null
    )
    assert.equal(
        await invoke(gameData.finishSnapshot, ctx, {
            id: claim.id,
            generation: claim.generation,
            fence: claim.fence,
            result: { errorCategory: null, nextAttemptAt: null },
        }),
        false
    )
    // A stale expected revision is refused without writing.
    assert.deepEqual(
        await invoke(sources.setCredential, ctx, {
            ...access("guild-a"),
            ref: refA,
            expectedRevision: 1,
            binding: {
                provider: "wardogs_warcon",
                origin: "https://wardogs.example.test",
                providerServerId: warconId,
            },
            credential: envelopeFor(bindingOf("guild-a", refA)),
            verified: true,
            testOutcome: "ok",
        }),
        { error: "revision_conflict" }
    )
    // A key tested against another endpoint is refused.
    assert.deepEqual(
        await invoke(sources.setCredential, ctx, {
            ...access("guild-a"),
            ref: refA,
            expectedRevision: 2,
            binding: {
                provider: "wardogs_warcon",
                origin: "https://attacker.example.test",
                providerServerId: warconId,
            },
            credential: envelopeFor(bindingOf("guild-a", refA)),
            verified: true,
            testOutcome: "ok",
        }),
        { error: "revision_conflict" }
    )
    // An unverified key is stored only with collection stopped.
    assert.deepEqual(
        await invoke(sources.setCredential, ctx, {
            ...access("guild-a"),
            ref: refA,
            expectedRevision: 2,
            binding: {
                provider: "wardogs_warcon",
                origin: "https://wardogs.example.test",
                providerServerId: warconId,
            },
            credential: envelopeFor(bindingOf("guild-a", refA)),
            verified: false,
            testOutcome: "unauthorized",
        }),
        { ok: true, revision: 3, enabled: false }
    )
    assert.equal(connection.enabled, false)
    const [listed] = (await invoke(sources.list, ctx, access("guild-a")))
        .sources
    assert.equal(listed.key.verified, false)
    assert.equal(listed.lastTest.outcome, "unauthorized")
})

test("removing a key or the source stops collection, deletes the key and keeps history", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    const connection = connectionOf(ctx, refA)
    connection.nextAttemptAt = 1
    const claim = await invoke(gameData.claimNext, ctx)
    assert.deepEqual(
        await invoke(sources.removeCredential, ctx, {
            ...access("guild-a"),
            ref: refA,
            expectedRevision: 1,
        }),
        { ok: true, revision: 2, enabled: false }
    )
    assert.equal(ctx.db.tables.gameDataCredentials!.length, 0)
    assert.equal(connection.enabled, false)
    const [listed] = (await invoke(sources.list, ctx, access("guild-a")))
        .sources
    assert.equal(listed.key.state, "missing")
    await assert.rejects(
        invoke(gameData.configureForDashboard, ctx, {
            ...access("guild-a"),
            sourceRef: refA,
            enabled: true,
        }),
        /not ready/
    )
    assert.equal(
        await invoke(gameData.finishSnapshot, ctx, {
            id: claim.id,
            generation: claim.generation,
            fence: claim.fence,
            result: { errorCategory: null, nextAttemptAt: null },
        }),
        false
    )
    ctx.db.seed("gameSessions", {
        _id: "gameSessions:kept",
        connectionId: connection._id,
        externalId: "1",
    })
    assert.deepEqual(
        await invoke(sources.remove, ctx, {
            ...access("guild-a"),
            ref: refA,
            expectedRevision: 2,
        }),
        { ok: true }
    )
    assert.equal(ctx.db.tables.gameDataSources!.length, 0)
    assert.equal(ctx.db.tables.gameSessions!.length, 1)
    assert.equal(connectionOf(ctx, refA).enabled, false)
})

test("legacy registrations never collect; operator entries keep their variable until a stored key wins", async (t) => {
    const operator = {
        ref: "valkyria-warcon",
        guildId: "guild-a",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        providerServerId: warconId,
        origin: "https://wardogs.example.test",
        secretRef: "LOGI_GAME_DATA_VALKYRIA_TOKEN",
        allowedAddresses: [],
    }
    const ctx = setup(t, [operator])
    // A workspace named another workspace's variable and its own host before this change.
    ctx.db.seed("gameDataSources", {
        _id: "gameDataSources:legacy",
        ref: "borrowed",
        guildId: "guild-b",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        providerServerId: warconId,
        origin: "https://attacker.example.test",
        secretRef: "LOGI_GAME_DATA_VALKYRIA_TOKEN",
        allowedAddresses: ["10.0.0.5"],
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        updatedBy: "200000000000000002",
    })
    ctx.db.seed("gameDataConnections", {
        _id: "gameDataConnections:legacy",
        sourceRef: "borrowed",
        guildId: "guild-b",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        providerServerId: warconId,
        sourceFingerprint: JSON.stringify({
            ref: "borrowed",
            guildId: "guild-b",
            gameId: "wardogs",
            provider: "wardogs_warcon",
            providerServerId: warconId,
            origin: "https://attacker.example.test",
            secretRef: "LOGI_GAME_DATA_VALKYRIA_TOKEN",
            allowedAddresses: ["10.0.0.5"],
        }),
        enabled: true,
        generation: 1,
        fence: 0,
        leaseUntil: 0,
        attempt: 0,
        nextAttemptAt: 1,
        errorCategory: null,
        pollAfterMs: 60_000,
        lastAttemptAt: null,
        observation: null,
        etag: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
    })
    assert.equal(await invoke(gameData.claimNext, ctx), null)
    const legacyConnection = connectionOf(ctx, "borrowed")
    assert.equal(legacyConnection.errorCategory, "configuration")
    assert.equal(legacyConnection.nextAttemptAt, null)
    const [legacy] = (await invoke(sources.list, ctx, access("guild-b")))
        .sources
    assert.equal(legacy.key.state, "needs_operator")
    // The operator entry uses its variable, and the dashboard cannot see the name.
    await invoke(gameData.configure, ctx, {
        secret,
        guildId: "guild-a",
        sourceRef: "valkyria-warcon",
        enabled: true,
    })
    const claim = await invoke(gameData.claimNext, ctx)
    assert.equal(claim.ref, "valkyria-warcon")
    assert.equal(claim.credentialMode, "legacy_env")
    const [listedOperator] = (
        await invoke(sources.list, ctx, access("guild-a"))
    ).sources
    assert.equal(listedOperator.key.state, "environment")
    assert.equal(listedOperator.managed, "operator")
    assert.equal(
        JSON.stringify(listedOperator).includes(
            "LOGI_GAME_DATA_VALKYRIA_TOKEN"
        ),
        false
    )
    // The workspace may store its own key; it then wins and is never removed back to the variable.
    assert.equal(
        (
            await invoke(sources.setCredential, ctx, {
                ...access("guild-a"),
                ref: "valkyria-warcon",
                expectedRevision: 0,
                binding: {
                    provider: "wardogs_warcon",
                    origin: "https://wardogs.example.test",
                    providerServerId: warconId,
                },
                credential: envelopeFor(
                    bindingOf("guild-a", "valkyria-warcon")
                ),
                verified: true,
                testOutcome: "ok",
            })
        ).ok,
        true
    )
    connectionOf(ctx, "valkyria-warcon").nextAttemptAt = 1
    assert.equal(
        (await invoke(gameData.claimNext, ctx)).credentialMode,
        "encrypted"
    )
    for (const fn of [sources.removeCredential, sources.remove])
        assert.deepEqual(
            await invoke(fn, ctx, {
                ...access("guild-a"),
                ref: "valkyria-warcon",
                expectedRevision: 1,
            }),
            { error: "operator_managed" }
        )
})

test("migration is a dry run first, idempotent, revision-checked and never prints a value", async (t) => {
    const operator = {
        ref: "valkyria-warcon",
        guildId: "guild-a",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        providerServerId: warconId,
        origin: "https://wardogs.example.test",
        secretRef: "LOGI_GAME_DATA_VALKYRIA_TOKEN",
    }
    const missing = {
        ...operator,
        ref: "missing",
        providerServerId: "22222222-2222-4222-8222-222222222222",
        secretRef: "LOGI_GAME_DATA_MISSING_TOKEN",
    }
    const ctx = setup(t, [operator, missing])
    setEnv(t, {
        LOGI_GAME_DATA_VALKYRIA_TOKEN: SENTINEL,
        LOGI_GAME_DATA_MISSING_TOKEN: undefined,
        LOGI_GAME_DATA_OWN_TOKEN: `${SENTINEL}-own`,
    })
    const legacyRow = {
        guildId: "guild-b",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        providerServerId: warconId,
        origin: "https://own.example.test",
        allowedAddresses: [],
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        updatedBy: "200000000000000002",
    }
    ctx.db.seed("gameDataSources", {
        ...legacyRow,
        _id: "gameDataSources:own",
        ref: "own",
        secretRef: "LOGI_GAME_DATA_OWN_TOKEN",
        allowedAddresses: ["10.0.0.5"],
    })
    ctx.db.seed("gameDataSources", {
        ...legacyRow,
        _id: "gameDataSources:borrowed",
        ref: "borrowed",
        providerServerId: "33333333-3333-4333-8333-333333333333",
        secretRef: "LOGI_GAME_DATA_VALKYRIA_TOKEN",
    })
    const reads: string[] = []
    const ports = {
        candidates: (input: Record<string, unknown>) =>
            invoke(migration.legacyCandidates, ctx, input),
        readVariable: (name: string) => {
            reads.push(name)
            return process.env[name]
        },
        encrypter: () => (plaintext: string, aad: string) =>
            encryptCredential(parseKeyring(ring1)!, plaintext, aad),
        adopt: (
            candidate: Parameters<
                Parameters<typeof migrateLegacyCredentials>[0]["adopt"]
            >[0],
            envelope: ReturnType<typeof encryptCredential>
        ) =>
            invoke(migration.adoptLegacyCredential, ctx, {
                kind: candidate.kind,
                guildId: candidate.guildId,
                ref: candidate.ref,
                secretRef: candidate.secretRef,
                expectedRevision: candidate.expectedRevision,
                envelope,
            }),
    }
    const run = (
        input: Partial<Parameters<typeof migrateLegacyCredentials>[1]>
    ) =>
        migrateLegacyCredentials(ports, {
            dryRun: true,
            phase: "operator",
            cursor: null,
            limit: 50,
            ...input,
        })
    const dry = await run({})
    assert.deepEqual(
        dry.results.map((result) => [result.ref, result.status]),
        [
            ["valkyria-warcon", "conflict"],
            ["missing", "missing_variable"],
        ]
    )
    assert.equal(ctx.db.tables.gameDataCredentials?.length ?? 0, 0)
    // The borrowed variable belongs to the operator source, not to guild-b.
    ctx.db.tables.gameDataSources = ctx.db.tables.gameDataSources!.filter(
        (row) => row.ref !== "borrowed"
    )
    assert.deepEqual(
        (await run({})).results.map((result) => result.status),
        ["would_migrate", "missing_variable"]
    )
    const applied = await run({ dryRun: false })
    assert.deepEqual(
        applied.results.map((result) => result.status),
        ["migrated", "missing_variable"]
    )
    // Idempotent: a migrated source is no longer a candidate.
    assert.deepEqual(
        (await run({ dryRun: false })).results.map((result) => result.ref),
        ["missing"]
    )
    assert.equal(
        await invoke(migration.adoptLegacyCredential, ctx, {
            kind: "operator",
            guildId: "guild-a",
            ref: "valkyria-warcon",
            secretRef: "LOGI_GAME_DATA_VALKYRIA_TOKEN",
            expectedRevision: 0,
            envelope: envelopeFor(bindingOf("guild-a", "valkyria-warcon")),
        }),
        "already_encrypted"
    )
    // A workspace registration needs an explicit, per-source confirmation.
    assert.deepEqual(
        (await run({ phase: "workspace", dryRun: false })).results.map(
            (result) => [
                result.ref,
                result.status,
                result.networkExceptionDropped,
            ]
        ),
        [["own", "needs_confirmation", true]]
    )
    // A revision change between planning and adoption is refused.
    assert.equal(
        await invoke(migration.adoptLegacyCredential, ctx, {
            kind: "workspace",
            guildId: "guild-b",
            ref: "own",
            secretRef: "LOGI_GAME_DATA_OWN_TOKEN",
            expectedRevision: 5,
            envelope: envelopeFor({
                ...bindingOf("guild-b", "own"),
                origin: "https://own.example.test",
            }),
        }),
        "stale"
    )
    const confirmed = await run({
        phase: "workspace",
        dryRun: false,
        guildId: "guild-b",
        ref: "own",
        confirmWorkspaceBinding: true,
    })
    assert.deepEqual(
        confirmed.results.map((result) => result.status),
        ["migrated"]
    )
    const own = ctx.db.tables.gameDataSources!.find((row) => row.ref === "own")!
    assert.equal(own.credentialMode, "encrypted")
    assert.equal(own.secretRef, null)
    assert.deepEqual(own.allowedAddresses, [])
    assert.equal(leaks(dry), false)
    assert.equal(leaks(applied), false)
    assert.equal(leaks(confirmed), false)
    assert.equal(leaks(ctx.db.tables), false)
    // Only the named variables were read.
    assert.deepEqual([...new Set(reads)].sort(), [
        "LOGI_GAME_DATA_MISSING_TOKEN",
        "LOGI_GAME_DATA_OWN_TOKEN",
        "LOGI_GAME_DATA_VALKYRIA_TOKEN",
    ])
})

test("re-encryption is resumable, compare-and-swap and keeps keys readable", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    await create(ctx, "guild-b", refB, {
        credential: envelopeFor(bindingOf("guild-b", refB)),
    })
    const ring2 = JSON.stringify({ current: "k2", keys: { k1, k2 } })
    setEnv(t, { LOGI_CREDENTIAL_KEYRING: ring2 })
    const keyring = parseKeyring(ring2)!
    let interfere = false
    const ports = {
        page: async (input: Record<string, unknown>) => {
            const page = await invoke(migration.credentialsPage, ctx, input)
            if (interfere) {
                // A key change lands between reading and replacing.
                ctx.db.tables.gameDataCredentials![1]!.version += 1
                interfere = false
            }
            return page
        },
        keyring: () => ({
            current: keyring.current,
            decrypt: (
                envelope: Parameters<typeof decryptCredential>[1],
                aad: string
            ) => decryptCredential(keyring, envelope, aad),
            encrypt: (plaintext: string, aad: string) =>
                encryptCredential(keyring, plaintext, aad),
        }),
        replace: (
            item: { id: string; version: number; envelope: { nonce: string } },
            envelope: ReturnType<typeof encryptCredential>
        ) =>
            invoke(migration.replaceCiphertext, ctx, {
                id: item.id,
                expectedVersion: item.version,
                expectedNonce: item.envelope.nonce,
                envelope,
            }),
    }
    const dry = await reencryptCredentials(ports, {
        dryRun: true,
        cursor: null,
        limit: 50,
    })
    assert.equal(dry.pending, 2)
    assert.equal(
        ctx.db.tables.gameDataCredentials!.every((row) => row.keyId === "k1"),
        true
    )
    const first = await reencryptCredentials(ports, {
        dryRun: false,
        cursor: null,
        limit: 1,
    })
    assert.equal(first.reencrypted, 1)
    assert.notEqual(first.nextCursor, null)
    interfere = true
    const second = await reencryptCredentials(ports, {
        dryRun: false,
        cursor: first.nextCursor,
        limit: 1,
    })
    assert.deepEqual(second.failures, [
        { guildId: "guild-b", ref: refB, reason: "stale" },
    ])
    const again = await reencryptCredentials(ports, {
        dryRun: false,
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        {
            current: again.current,
            reencrypted: again.reencrypted,
            failures: again.failures,
        },
        { current: 1, reencrypted: 1, failures: [] }
    )
    for (const row of ctx.db.tables.gameDataCredentials!) {
        assert.equal(row.keyId, "k2")
        assert.equal(
            decryptCredential(
                parseKeyring(JSON.stringify({ current: "k2", keys: { k2 } })),
                {
                    format: 1,
                    keyId: row.keyId,
                    nonce: row.nonce,
                    ciphertext: row.ciphertext,
                    tag: row.tag,
                },
                credentialAad(bindingOf(row.guildId, row.sourceRef))
            ),
            SENTINEL
        )
    }
    assert.equal(leaks([dry, first, second, again]), false)
})

test("a stored-key test is authorized internally, spends quota and records only the outcome", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    const { getFunctionName } = await import("convex/server")
    const actions = await import("../../../convex/gameDataCredentialActions")
    const internalFunctions: Record<string, unknown> = {
        "gameDataSources:reserveStoredTest": sources.reserveStoredTest,
        "gameDataSources:recordStoredTest": sources.recordStoredTest,
    }
    const actionCtx = {
        runMutation: (
            ref: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) => invoke(internalFunctions[getFunctionName(ref)], ctx, args),
    }
    const handler = (
        actions.testStored as unknown as {
            _handler: (
                ctx: typeof actionCtx,
                args: Record<string, unknown>
            ) => Promise<{ outcome?: string; error?: string }>
        }
    )._handler
    const testStored = (guildId: string) =>
        handler(actionCtx, { ...access(guildId), ref: refA })
    assert.deepEqual(await testStored("guild-b"), { error: "not_found" })
    // Without this runtime's keyring the stored key is unusable, never replaced.
    setEnv(t, { LOGI_CREDENTIAL_KEYRING: undefined })
    const result = await testStored("guild-a")
    assert.deepEqual(result, { outcome: "key_unavailable" })
    const row = ctx.db.tables.gameDataSources![0]!
    assert.equal(row.lastTestOutcome, "key_unavailable")
    // The quota bounds repeated tests of one source.
    for (let i = 0; i < 5; i++) await testStored("guild-a")
    const limited = await testStored("guild-a")
    assert.equal(limited.error, "rate_limited")
    assert.equal(leaks(ctx.db.tables), false)
})

test("a late stored-key test result never verifies a replaced key", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    const reserved = await invoke(sources.reserveStoredTest, ctx, {
        ...access("guild-a"),
        ref: refA,
    })
    // Meanwhile the key is removed and another one is saved unverified at version 1 again.
    const removed = await invoke(sources.removeCredential, ctx, {
        ...access("guild-a"),
        ref: refA,
        expectedRevision: 1,
    })
    await invoke(sources.setCredential, ctx, {
        ...access("guild-a"),
        ref: refA,
        expectedRevision: removed.revision,
        binding: {
            provider: "wardogs_warcon",
            origin: "https://wardogs.example.test",
            providerServerId: warconId,
        },
        credential: envelopeFor(bindingOf("guild-a", refA), "second-key-0002"),
        verified: false,
        testOutcome: "server_mismatch",
    })
    const stored = ctx.db.tables.gameDataCredentials![0]!
    assert.equal(stored.version, reserved.tested.version)
    await invoke(sources.recordStoredTest, ctx, {
        guildId: "guild-a",
        ref: refA,
        tested: reserved.tested,
        outcome: "ok",
    })
    assert.equal(stored.verifiedAt, null)
    const row = ctx.db.tables.gameDataSources![0]!
    assert.equal(row.lastTestOutcome, "server_mismatch")
    assert.deepEqual(
        await invoke(sources.setEnabled, ctx, {
            ...access("guild-a"),
            ref: refA,
            enabled: true,
        }),
        { error: "verification_required" }
    )
    // A result for the current key does verify it.
    const current = await invoke(sources.reserveStoredTest, ctx, {
        ...access("guild-a"),
        ref: refA,
    })
    await invoke(sources.recordStoredTest, ctx, {
        guildId: "guild-a",
        ref: refA,
        tested: current.tested,
        outcome: "ok",
    })
    assert.notEqual(stored.verifiedAt, null)
})

test("removing an optional CRCON key stops collection instead of going keyless", async (t) => {
    const ctx = setup(t)
    const crcon = {
        guildId: "guild-a",
        sourceRef: refA,
        provider: "hll_crcon" as const,
        origin: "https://crcon.example.test",
        providerServerId: "1",
    }
    await create(ctx, "guild-a", refA, {
        source: {
            ref: refA,
            displayName: "CRCON",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            origin: crcon.origin,
            providerServerId: "1",
        },
        credential: envelopeFor(crcon),
    })
    assert.equal(connectionOf(ctx, refA).enabled, true)
    assert.deepEqual(
        await invoke(sources.removeCredential, ctx, {
            ...access("guild-a"),
            ref: refA,
            expectedRevision: 1,
        }),
        { ok: true, revision: 2, enabled: false }
    )
    assert.equal(connectionOf(ctx, refA).enabled, false)
    // Keyless collection is an explicit choice afterwards.
    assert.deepEqual(
        await invoke(sources.setEnabled, ctx, {
            ...access("guild-a"),
            ref: refA,
            enabled: true,
        }),
        { ok: true }
    )
})

test("test quotas are all-or-nothing and follow the administrator across workspaces", async (t) => {
    const ctx = setup(t)
    await create(ctx, "guild-a", refA)
    const reserve = (guildId: string, ref: string | null) =>
        invoke(sources.reserveTest, ctx, { ...access(guildId), ref })
    for (let i = 0; i < 6; i++)
        assert.equal((await reserve("guild-a", refA)).ok, true)
    assert.equal((await reserve("guild-a", refA)).error, "rate_limited")
    // The refused per-source test did not spend the workspace quota.
    const workspace = ctx.db.tables.apiRateLimitBuckets!.find(
        (row) => row.bucket === "game-data-test:guild-a"
    )!
    assert.equal(workspace.count, 6)
    for (let i = 0; i < 24; i++)
        assert.equal((await reserve("guild-b", null)).ok, true)
    // The same administrator has used 30 tests in two workspaces.
    const limited = await reserve("guild-b", null)
    assert.equal(limited.error, "rate_limited")
    assert.ok(limited.retryAfterMs > 0)
})

test("the operator can return an operator source to its variable; workspaces cannot", async (t) => {
    const operator = {
        ref: "valkyria-warcon",
        guildId: "guild-a",
        gameId: "wardogs",
        provider: "wardogs_warcon",
        providerServerId: warconId,
        origin: "https://wardogs.example.test",
        secretRef: "LOGI_GAME_DATA_VALKYRIA_TOKEN",
    }
    const ctx = setup(t, [operator])
    await invoke(sources.setCredential, ctx, {
        ...access("guild-a"),
        ref: "valkyria-warcon",
        expectedRevision: 0,
        binding: {
            provider: "wardogs_warcon",
            origin: "https://wardogs.example.test",
            providerServerId: warconId,
        },
        credential: envelopeFor(bindingOf("guild-a", "valkyria-warcon")),
        verified: true,
        testOutcome: "ok",
    })
    assert.equal(
        await invoke(migration.removeOperatorSourceKey, ctx, {
            guildId: "guild-b",
            ref: "valkyria-warcon",
        }),
        "not_found"
    )
    assert.equal(
        await invoke(migration.removeOperatorSourceKey, ctx, {
            guildId: "guild-a",
            ref: "valkyria-warcon",
        }),
        "removed"
    )
    assert.equal(ctx.db.tables.gameDataCredentials!.length, 0)
    const [listed] = (await invoke(sources.list, ctx, access("guild-a")))
        .sources
    assert.equal(listed.key.state, "environment")
})
