import {
    credentialRequirement,
    displayNameKey,
    GAME_SERVER_SOURCE_LIMIT,
    sameSourceIdentity,
    sourceFingerprint,
    type ConnectionTestOutcome,
    type GameServerSource,
    type SourceCommandError,
} from "../src/domain/game-data/credentials"
import {
    credentialEnvelopeSchema,
    displayNameSchema,
    draftSource,
    generatedSourceRefSchema,
    keyringIndex,
    sourceDraftSchema,
} from "../src/domain/game-data/credentials.schema"
import {
    connectionFor,
    operatorSources,
    resolveSource,
    workspaceSources,
    type CatalogEntry,
} from "./gameDataCatalog"
import {
    gameDataCredentialEnvelope,
    gameDataTestOutcome,
} from "./gameDataValidators"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { mutation, internalMutation } from "./integrationMutation"
import { projectHealth } from "../src/domain/game-data/policy"
import { query, type MutationCtx } from "./_generated/server"
import { applyConnectionSource } from "./gameData"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
type Failure = { error: SourceCommandError; retryAfterMs?: number }
const fail = (error: SourceCommandError): Failure => ({ error })
/** Connection tests per workspace and per source within one window. */
const TEST_WINDOW_MS = 10 * 60_000
const TESTS_PER_WORKSPACE = 30
const TESTS_PER_SOURCE = 6
const TESTS_PER_ACTOR = 30

function revisionOf(entry: CatalogEntry): number {
    return entry.row
        ? (entry.row.revision ?? 0)
        : (entry.credential?.version ?? 0)
}

/**
 * Dashboard projection of one source: an explicit allowlist that never
 * includes ciphertext, nonce, tag, key ID, variable name or network exception.
 */
function projectSource(
    entry: CatalogEntry,
    connection: Doc<"gameDataConnections"> | null,
    now: number
): GameServerSource {
    const { source, row, credential } = entry
    const health = connection
        ? projectHealth({ ...connection, id: String(connection._id) }, now)
        : null
    const requirement = credentialRequirement(source.provider)
    const state: GameServerSource["key"]["state"] =
        source.credentialMode === "encrypted" && credential
            ? "set"
            : source.credentialMode === "legacy_env"
              ? source.usable
                  ? "environment"
                  : "needs_operator"
              : requirement === "required"
                ? "missing"
                : "not_required"
    const failure =
        credential?.failure &&
        (!health?.lastSuccessAt ||
            (credential.failureAt ?? "") > health.lastSuccessAt)
            ? credential.failure
            : null
    const testAt = row ? row.lastTestAt : credential?.lastTestAt
    const testOutcome = row ? row.lastTestOutcome : credential?.lastTestOutcome
    return {
        ref: source.ref,
        displayName: row?.displayName ?? source.ref,
        gameId: source.gameId,
        provider: source.provider,
        origin: new URL(source.origin).origin,
        providerServerId: source.providerServerId,
        managed: source.managed,
        revision: revisionOf(entry),
        key: {
            state,
            changedAt: credential?.updatedAt ?? null,
            verified: Boolean(credential?.verifiedAt),
            failure,
        },
        collection: connection
            ? {
                  enabled: connection.enabled,
                  errorCategory: connection.errorCategory,
                  lastSuccessAt: health?.lastSuccessAt ?? null,
              }
            : null,
        lastTest:
            testAt && testOutcome ? { at: testAt, outcome: testOutcome } : null,
    }
}

/** This workspace's operator entries and registrations; never a key or ciphertext. */
export const list = query({
    args: access,
    handler: async (
        ctx,
        args
    ): Promise<{ sources: GameServerSource[]; limit: number }> => {
        await authorizeDashboardAdmin(ctx, args)
        const now = Date.now()
        const entries = await workspaceSources(ctx, args.guildId)
        return {
            sources: await Promise.all(
                entries.map(async (entry) =>
                    projectSource(
                        entry,
                        await connectionFor(
                            ctx,
                            args.guildId,
                            entry.source.ref
                        ),
                        now
                    )
                )
            ),
            limit: GAME_SERVER_SOURCE_LIMIT,
        }
    },
})

/** A ciphertext this Convex deployment could decrypt later; refused otherwise. */
export function acceptedEnvelope(value: unknown) {
    const envelope = credentialEnvelopeSchema.safeParse(value)
    const keyring = keyringIndex(process.env.LOGI_CREDENTIAL_KEYRING)
    if (!envelope.success) return null
    return keyring?.ids.includes(envelope.data.keyId) ? envelope.data : null
}

/**
 * After a credential write: a new generation fences in-flight collection,
 * history and live reads (their writes and cached reads stop matching), the
 * fingerprint follows the source and history keeps its progress.
 */
export async function refreshConnectionCredential(
    ctx: MutationCtx,
    input: {
        guildId: string
        sourceRef: string
        entry: CatalogEntry | null
        enabled?: boolean
    }
): Promise<boolean> {
    const connection = await connectionFor(ctx, input.guildId, input.sourceRef)
    if (!connection) return false
    const enabled = (input.enabled ?? connection.enabled) && connection.enabled
    const now = Date.now()
    await ctx.db.patch(connection._id, {
        enabled,
        generation: connection.generation + 1,
        leaseUntil: 0,
        attempt: 0,
        nextAttemptAt: enabled ? now : null,
        errorCategory: null,
        etag: null,
        updatedAt: new Date(now).toISOString(),
        ...(input.entry
            ? { sourceFingerprint: sourceFingerprint(input.entry.source) }
            : {}),
    })
    const run = await ctx.db
        .query("gameDataHistoryRuns")
        .withIndex("connectionId", (q) => q.eq("connectionId", connection._id))
        .unique()
    if (run)
        await ctx.db.patch(run._id, {
            leaseUntil: 0,
            attempt: 0,
            nextAttemptAt: enabled ? now : null,
            errorCategory: null,
        })
    return enabled
}

/**
 * Spends one test from every bucket, or from none: a refusal by any bucket
 * leaves all counters unchanged and reports the longest wait.
 */
async function takeBuckets(
    ctx: MutationCtx,
    buckets: ReadonlyArray<{ name: string; limit: number }>,
    now: number
): Promise<number | null> {
    const rows = await Promise.all(
        buckets.map(async (bucket) => ({
            ...bucket,
            row: await ctx.db
                .query("apiRateLimitBuckets")
                .withIndex("bucket", (q) => q.eq("bucket", bucket.name))
                .unique(),
        }))
    )
    const waits = rows
        .filter(
            ({ row, limit }) => row && row.resetAt > now && row.count >= limit
        )
        .map(({ row }) => row!.resetAt - now)
    if (waits.length) return Math.max(...waits)
    for (const { name, row } of rows) {
        if (row && row.resetAt > now)
            await ctx.db.patch(row._id, { count: row.count + 1 })
        else if (row)
            await ctx.db.patch(row._id, {
                count: 1,
                resetAt: now + TEST_WINDOW_MS,
            })
        else
            await ctx.db.insert("apiRateLimitBuckets", {
                bucket: name,
                count: 1,
                resetAt: now + TEST_WINDOW_MS,
            })
    }
    return null
}

/**
 * Bounds connection tests before any provider request: per workspace, per
 * source and per administrator across workspaces, so creating more
 * workspaces does not buy more probes.
 */
async function reserveTestQuota(
    ctx: MutationCtx,
    input: { guildId: string; sourceRef: string | null; actor: string }
): Promise<Failure | null> {
    const wait = await takeBuckets(
        ctx,
        [
            {
                name: `game-data-test:${input.guildId}`,
                limit: TESTS_PER_WORKSPACE,
            },
            {
                name: `game-data-test-actor:${input.actor}`,
                limit: TESTS_PER_ACTOR,
            },
            ...(input.sourceRef
                ? [
                      {
                          name: `game-data-test:${input.guildId}:${input.sourceRef}`,
                          limit: TESTS_PER_SOURCE,
                      },
                  ]
                : []),
        ],
        Date.now()
    )
    return wait === null ? null : { error: "rate_limited", retryAfterMs: wait }
}

/**
 * The gateway reserves a test of a key it holds in memory (a new source or a
 * key change). Returns the stored identity the key will be bound to, so the
 * gateway tests exactly the endpoint the ciphertext will name.
 */
export const reserveTest = mutation({
    args: { ...access, ref: v.union(v.string(), v.null()) },
    handler: async (
        ctx,
        args
    ): Promise<
        | {
              ok: true
              binding: {
                  gameId: GameServerSource["gameId"]
                  provider: GameServerSource["provider"]
                  origin: string
                  providerServerId: string
                  revision: number
              } | null
          }
        | Failure
    > => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const entry = args.ref
            ? await resolveSource(ctx, args.guildId, args.ref)
            : null
        if (args.ref && !entry) return fail("not_found")
        const limited = await reserveTestQuota(ctx, {
            guildId: args.guildId,
            sourceRef: args.ref,
            actor: admin.session.subject,
        })
        if (limited) return limited
        return {
            ok: true,
            binding: entry
                ? {
                      gameId: entry.source.gameId,
                      provider: entry.source.provider,
                      origin: entry.source.origin,
                      providerServerId: entry.source.providerServerId,
                      revision: revisionOf(entry),
                  }
                : null,
        }
    },
})

/**
 * A new workspace source with its optional encrypted key. The gateway tested
 * the key against this identity first (`verified`); collection starts only
 * when requested and verified, otherwise the source is a disabled draft.
 */
export const create = mutation({
    args: {
        ...access,
        source: v.object({
            ref: v.string(),
            displayName: v.string(),
            gameId: v.string(),
            provider: v.string(),
            origin: v.string(),
            providerServerId: v.string(),
        }),
        credential: v.union(gameDataCredentialEnvelope, v.null()),
        verified: v.boolean(),
        testOutcome: v.union(gameDataTestOutcome, v.null()),
        enable: v.boolean(),
    },
    handler: async (
        ctx,
        args
    ): Promise<
        { ok: true; ref: string; revision: number; enabled: boolean } | Failure
    > => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const { ref, ...fields } = args.source
        const draft = sourceDraftSchema.safeParse(fields)
        if (!generatedSourceRefSchema.safeParse(ref).success || !draft.success)
            return fail("invalid_source")
        const built = draftSource(draft.data, { guildId: args.guildId, ref })
        if (!built.ok) return fail("invalid_source")
        const requirement = credentialRequirement(built.source.provider)
        if (requirement === "required" && !args.credential)
            return fail("key_required")
        if (requirement === "forbidden" && args.credential)
            return fail("key_not_allowed")
        const envelope = args.credential
            ? acceptedEnvelope(args.credential)
            : null
        if (args.credential && !envelope) return fail("encryption_unavailable")
        if (args.enable && !args.verified) return fail("verification_required")
        const existing = await workspaceSources(ctx, args.guildId)
        if (
            existing.filter((entry) => entry.row).length >=
            GAME_SERVER_SOURCE_LIMIT
        )
            return fail("limit_reached")
        const name = displayNameKey(draft.data.displayName)
        if (
            existing.some(
                (entry) =>
                    displayNameKey(
                        entry.row?.displayName ?? entry.source.ref
                    ) === name
            )
        )
            return fail("duplicate_name")
        if (
            existing.some((entry) =>
                sameSourceIdentity(entry.source, built.source)
            )
        )
            return fail("duplicate_identity")
        // References are global: a generated one must not meet any other source.
        if (
            operatorSources().some((source) => source.ref === ref) ||
            (await ctx.db
                .query("gameDataSources")
                .withIndex("ref", (q) => q.eq("ref", ref))
                .first())
        )
            return fail("invalid_source")
        const now = new Date().toISOString()
        await ctx.db.insert("gameDataSources", {
            ref,
            guildId: args.guildId,
            gameId: built.source.gameId,
            provider: built.source.provider,
            providerServerId: built.source.providerServerId,
            origin: built.source.origin,
            secretRef: null,
            allowedAddresses: [],
            displayName: draft.data.displayName,
            credentialMode: envelope ? "encrypted" : "none",
            revision: 1,
            createdAt: now,
            updatedAt: now,
            updatedBy: admin.session.subject,
            createdBy: admin.session.subject,
            ...(args.testOutcome
                ? { lastTestAt: now, lastTestOutcome: args.testOutcome }
                : {}),
        })
        if (envelope)
            await ctx.db.insert("gameDataCredentials", {
                guildId: args.guildId,
                sourceRef: ref,
                ...envelope,
                version: 1,
                verifiedAt: args.verified ? now : null,
                createdAt: now,
                updatedAt: now,
                updatedBy: admin.session.subject,
            })
        await applyConnectionSource(ctx, {
            guildId: args.guildId,
            sourceRef: ref,
            enabled: args.enable,
        })
        return { ok: true, ref, revision: 1, enabled: args.enable }
    },
})

async function editableEntry(
    ctx: MutationCtx,
    args: { guildId: string; ref: string; expectedRevision: number },
    options: { workspaceOnly: boolean }
): Promise<{ entry: CatalogEntry } | Failure> {
    const entry = await resolveSource(ctx, args.guildId, args.ref)
    if (!entry) return fail("not_found")
    if (options.workspaceOnly && !entry.row) return fail("operator_managed")
    if (revisionOf(entry) !== args.expectedRevision)
        return fail("revision_conflict")
    return { entry }
}

export const rename = mutation({
    args: {
        ...access,
        ref: v.string(),
        expectedRevision: v.number(),
        displayName: v.string(),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ ok: true; revision: number } | Failure> => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const name = displayNameSchema.safeParse(args.displayName)
        if (!name.success) return fail("invalid_source")
        const found = await editableEntry(ctx, args, { workspaceOnly: true })
        if ("error" in found) return found
        const row = found.entry.row!
        const key = displayNameKey(name.data)
        if (
            (await workspaceSources(ctx, args.guildId)).some(
                (entry) =>
                    entry.source.ref !== args.ref &&
                    displayNameKey(
                        entry.row?.displayName ?? entry.source.ref
                    ) === key
            )
        )
            return fail("duplicate_name")
        const revision = (row.revision ?? 0) + 1
        await ctx.db.patch(row._id, {
            displayName: name.data,
            revision,
            updatedAt: new Date().toISOString(),
            updatedBy: admin.session.subject,
        })
        return { ok: true, revision }
    },
})

/**
 * Stores a new key for an existing source. The gateway encrypted it for the
 * identity it was given; a different identity now (or a newer revision) means
 * the key was tested against something else and is refused. An unverified key
 * is stored only on request and stops collection until a test passes.
 */
export const setCredential = mutation({
    args: {
        ...access,
        ref: v.string(),
        expectedRevision: v.number(),
        binding: v.object({
            provider: v.string(),
            origin: v.string(),
            providerServerId: v.string(),
        }),
        credential: gameDataCredentialEnvelope,
        verified: v.boolean(),
        testOutcome: v.union(gameDataTestOutcome, v.null()),
    },
    handler: async (
        ctx,
        args
    ): Promise<{ ok: true; revision: number; enabled: boolean } | Failure> => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const found = await editableEntry(ctx, args, { workspaceOnly: false })
        if ("error" in found) return found
        const { entry } = found
        if (credentialRequirement(entry.source.provider) === "forbidden")
            return fail("key_not_allowed")
        if (
            args.binding.provider !== entry.source.provider ||
            args.binding.providerServerId !== entry.source.providerServerId ||
            args.binding.origin !== entry.source.origin
        )
            return fail("revision_conflict")
        const envelope = acceptedEnvelope(args.credential)
        if (!envelope) return fail("encryption_unavailable")
        const now = new Date().toISOString()
        const test = args.testOutcome
            ? { lastTestAt: now, lastTestOutcome: args.testOutcome }
            : {}
        const version = (entry.credential?.version ?? 0) + 1
        if (entry.credential)
            await ctx.db.patch(entry.credential._id, {
                ...envelope,
                version,
                verifiedAt: args.verified ? now : null,
                updatedAt: now,
                updatedBy: admin.session.subject,
                failure: undefined,
                failureAt: undefined,
                reencryptedAt: undefined,
                ...(entry.row ? {} : test),
            })
        else
            await ctx.db.insert("gameDataCredentials", {
                guildId: args.guildId,
                sourceRef: args.ref,
                ...envelope,
                version,
                verifiedAt: args.verified ? now : null,
                createdAt: now,
                updatedAt: now,
                updatedBy: admin.session.subject,
                ...(entry.row ? {} : test),
            })
        let revision = version
        if (entry.row) {
            revision = (entry.row.revision ?? 0) + 1
            // The administrator's key replaces any legacy variable and network exception.
            await ctx.db.patch(entry.row._id, {
                credentialMode: "encrypted",
                secretRef: null,
                allowedAddresses: [],
                revision,
                updatedAt: now,
                updatedBy: admin.session.subject,
                ...test,
            })
        }
        const enabled = await refreshConnectionCredential(ctx, {
            guildId: args.guildId,
            sourceRef: args.ref,
            entry: await resolveSource(ctx, args.guildId, args.ref),
            enabled: args.verified,
        })
        return { ok: true, revision, enabled }
    },
})

/**
 * Deletes a workspace source's stored key and stops collection, also for a
 * provider that can read keyless: switching to unauthenticated requests needs
 * an explicit start. Operator sources keep their key: removing it would
 * silently return them to their environment variable.
 */
export const removeCredential = mutation({
    args: { ...access, ref: v.string(), expectedRevision: v.number() },
    handler: async (
        ctx,
        args
    ): Promise<{ ok: true; revision: number; enabled: boolean } | Failure> => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const found = await editableEntry(ctx, args, { workspaceOnly: true })
        if ("error" in found) return found
        const { entry } = found
        const row = entry.row!
        if (entry.credential) await ctx.db.delete(entry.credential._id)
        const revision = (row.revision ?? 0) + 1
        await ctx.db.patch(row._id, {
            credentialMode: "none",
            secretRef: null,
            allowedAddresses: [],
            revision,
            updatedAt: new Date().toISOString(),
            updatedBy: admin.session.subject,
        })
        const enabled = await refreshConnectionCredential(ctx, {
            guildId: args.guildId,
            sourceRef: args.ref,
            entry: await resolveSource(ctx, args.guildId, args.ref),
            enabled: false,
        })
        return { ok: true, revision, enabled }
    },
})

/**
 * Starts or stops collection with typed refusals: a source needs a usable key,
 * and a stored key must have passed a connection test.
 */
export const setEnabled = mutation({
    args: { ...access, ref: v.string(), enabled: v.boolean() },
    handler: async (ctx, args): Promise<{ ok: true } | Failure> => {
        await authorizeDashboardAdmin(ctx, args)
        const entry = await resolveSource(ctx, args.guildId, args.ref)
        if (!entry) return fail("not_found")
        if (args.enabled && !entry.source.usable)
            return fail(
                entry.reason === "key_not_allowed"
                    ? "key_not_allowed"
                    : "key_required"
            )
        if (
            args.enabled &&
            entry.source.credentialMode === "encrypted" &&
            !entry.credential?.verifiedAt
        )
            return fail("verification_required")
        await applyConnectionSource(
            ctx,
            {
                guildId: args.guildId,
                sourceRef: args.ref,
                enabled: args.enabled,
            },
            { requireVerifiedKey: true }
        )
        return { ok: true }
    },
})

/** Removing a source stops its collection and deletes its key; retained history stays. */
export const remove = mutation({
    args: { ...access, ref: v.string(), expectedRevision: v.number() },
    handler: async (ctx, args): Promise<{ ok: true } | Failure> => {
        await authorizeDashboardAdmin(ctx, args)
        const found = await editableEntry(ctx, args, { workspaceOnly: true })
        if ("error" in found) return found
        const { entry } = found
        await refreshConnectionCredential(ctx, {
            guildId: args.guildId,
            sourceRef: args.ref,
            entry: null,
            enabled: false,
        })
        if (entry.credential) await ctx.db.delete(entry.credential._id)
        await ctx.db.delete(entry.row!._id)
        return { ok: true }
    },
})

/**
 * Internal half of a stored-key test: authorizes the administrator, spends the
 * quota and hands the source and its ciphertext to the test action only.
 */
export const reserveStoredTest = internalMutation({
    args: { ...access, ref: v.string() },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const entry = await resolveSource(ctx, args.guildId, args.ref)
        if (!entry) return fail("not_found")
        const limited = await reserveTestQuota(ctx, {
            guildId: args.guildId,
            sourceRef: args.ref,
            actor: admin.session.subject,
        })
        if (limited) return limited
        return {
            ok: true as const,
            source: entry.source,
            envelope: entry.credential
                ? {
                      format: entry.credential.format,
                      keyId: entry.credential.keyId,
                      nonce: entry.credential.nonce,
                      ciphertext: entry.credential.ciphertext,
                      tag: entry.credential.tag,
                  }
                : null,
            tested: testedCredential(entry),
        }
    },
})

/**
 * The exact stored key a test used: row, version and nonce. A removed and
 * re-added key restarts its version, so the version alone cannot tell keys apart.
 */
function testedCredential(entry: CatalogEntry) {
    return entry.credential
        ? {
              id: String(entry.credential._id),
              version: entry.credential.version,
              nonce: entry.credential.nonce,
          }
        : null
}

/**
 * Records a stored-key test only if the key is still the one that was tested;
 * a pass then verifies exactly that key. A late result for a replaced key
 * changes nothing.
 */
export const recordStoredTest = internalMutation({
    args: {
        guildId: v.string(),
        ref: v.string(),
        tested: v.union(
            v.object({
                id: v.string(),
                version: v.number(),
                nonce: v.string(),
            }),
            v.null()
        ),
        outcome: gameDataTestOutcome,
    },
    handler: async (ctx, args): Promise<void> => {
        const entry = await resolveSource(ctx, args.guildId, args.ref)
        if (!entry) return
        const current = testedCredential(entry)
        if (
            current?.id !== args.tested?.id ||
            current?.version !== args.tested?.version ||
            current?.nonce !== args.tested?.nonce
        )
            return
        const now = new Date().toISOString()
        const test = { lastTestAt: now, lastTestOutcome: args.outcome }
        if (entry.row) await ctx.db.patch(entry.row._id, test)
        if (entry.credential)
            await ctx.db.patch(entry.credential._id, {
                ...(entry.row ? {} : test),
                ...(args.outcome === "ok" ? { verifiedAt: now } : {}),
            })
    },
})

export type StoredTestResult =
    { outcome: ConnectionTestOutcome; retryAfterMs?: number } | Failure
