import {
    credentialRequirement,
    displayNameSchema,
    draftSource,
    gameServerSourceListSchema,
    providerKeySchema,
    sourceCommandErrorSchema,
    sourceDraftSchema,
    type ConnectionTestOutcome,
    type CredentialBinding,
    type CredentialEnvelope,
    type DataProvider,
    type SourceCommandError,
} from "@/domain/game-data/credentials"
import type { ConnectionTestResult } from "@/infrastructure/game-data/connection-test"
import type { DataSource } from "@/domain/game-data/contracts"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

/** Large enough for the longest key and a draft; anything bigger is refused unread. */
export const SOURCE_COMMAND_MAX_BYTES = 8192
const ref = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
const revision = z.number().int().nonnegative().max(1_000_000_000)
const commandSchema = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("test"),
        draft: sourceDraftSchema,
        key: z.string().max(4200).nullable(),
    }),
    z.strictObject({
        action: z.literal("create"),
        draft: sourceDraftSchema,
        key: z.string().max(4200).nullable(),
        enable: z.boolean(),
    }),
    z.strictObject({
        action: z.literal("set_key"),
        ref,
        expectedRevision: revision,
        key: z.string().max(4200),
        allowUnverified: z.boolean(),
    }),
    z.strictObject({ action: z.literal("test_stored"), ref }),
    z.strictObject({
        action: z.literal("remove_key"),
        ref,
        expectedRevision: revision,
    }),
    z.strictObject({
        action: z.literal("rename"),
        ref,
        expectedRevision: revision,
        displayName: displayNameSchema,
    }),
    z.strictObject({
        action: z.literal("remove"),
        ref,
        expectedRevision: revision,
    }),
    z.strictObject({
        action: z.literal("set_enabled"),
        ref,
        enabled: z.boolean(),
    }),
])

type Failure = { error: SourceCommandError; retryAfterMs?: number }
type Binding = {
    gameId: DataSource["gameId"]
    provider: DataProvider
    origin: string
    providerServerId: string
    revision: number
}
/** What the route needs from the session, Convex and this process; injected for tests. */
export type GameDataSourcePorts = {
    /** Session, workspace administrator and the actor, re-checked by every Convex call. */
    authorize(serverId: string): Promise<{ guildId: string } | null>
    list(guildId: string): Promise<unknown>
    reserveTest(
        guildId: string,
        ref: string | null
    ): Promise<{ ok: true; binding: Binding | null } | Failure>
    create(
        guildId: string,
        input: {
            source: Record<string, string>
            credential: CredentialEnvelope | null
            verified: boolean
            testOutcome: ConnectionTestOutcome | null
            enable: boolean
        }
    ): Promise<
        { ok: true; ref: string; revision: number; enabled: boolean } | Failure
    >
    setCredential(
        guildId: string,
        input: {
            ref: string
            expectedRevision: number
            binding: {
                provider: string
                origin: string
                providerServerId: string
            }
            credential: CredentialEnvelope
            verified: boolean
            testOutcome: ConnectionTestOutcome | null
        }
    ): Promise<{ ok: true; revision: number; enabled: boolean } | Failure>
    command(
        guildId: string,
        name: "removeCredential" | "rename" | "remove" | "setEnabled",
        input: Record<string, unknown>
    ): Promise<{ ok: true } | Failure>
    testStored(
        guildId: string,
        ref: string
    ): Promise<ConnectionTestResult | Failure>
    encryption(): {
        encrypt(binding: CredentialBinding, key: string): CredentialEnvelope
    } | null
    testConnection(
        source: DataSource,
        key: string | null
    ): Promise<ConnectionTestResult>
    newRef(): string
}

const STATUS: Partial<Record<SourceCommandError, number>> = {
    not_found: 404,
    revision_conflict: 409,
    rate_limited: 429,
    encryption_unavailable: 503,
    unavailable: 503,
}
function json(body: unknown, status = 200) {
    return Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store" },
    })
}
function failure(value: Failure) {
    const error = sourceCommandErrorSchema.safeParse(value.error)
    const code = error.success ? error.data : "unavailable"
    return json(
        {
            error: code,
            ...(value.retryAfterMs !== undefined
                ? { retryAfterMs: Math.max(0, Math.round(value.retryAfterMs)) }
                : {}),
        },
        STATUS[code] ?? 400
    )
}
const isFailure = (value: object): value is Failure => "error" in value
/** Only categories leave this route; a provider body or key never does. */
const testBody = (result: ConnectionTestResult) => ({
    outcome: result.outcome,
    ...(result.retryAfterMs !== undefined
        ? { retryAfterMs: Math.max(0, Math.round(result.retryAfterMs)) }
        : {}),
})

/**
 * Same-origin JSON commands for one workspace's game servers. A key arrives
 * only here, is validated and tested in memory, and leaves this process only as
 * AES-256-GCM ciphertext bound to the source; responses never repeat it.
 */
export function gameDataSourceHandlers(ports: GameDataSourcePorts) {
    async function run(guildId: string, raw: unknown): Promise<Response> {
        const parsed = commandSchema.safeParse(raw)
        if (!parsed.success) return failure({ error: "invalid_source" })
        const command = parsed.data
        if (command.action === "test_stored") {
            const result = await ports.testStored(guildId, command.ref)
            return "error" in result ? failure(result) : json(testBody(result))
        }
        if (
            command.action === "remove_key" ||
            command.action === "rename" ||
            command.action === "remove" ||
            command.action === "set_enabled"
        ) {
            const { action, ...input } = command
            const result = await ports.command(
                guildId,
                action === "remove_key"
                    ? "removeCredential"
                    : action === "set_enabled"
                      ? "setEnabled"
                      : action,
                input
            )
            return isFailure(result) ? failure(result) : json(result)
        }

        const rawKey = "key" in command ? command.key : null
        const key =
            rawKey === null || rawKey.trim() === ""
                ? null
                : providerKeySchema.safeParse(rawKey)
        if (key && !key.success) return failure({ error: "invalid_key" })
        const plaintext = key?.data ?? null

        if (command.action === "set_key") {
            if (plaintext === null) return failure({ error: "invalid_key" })
            const encryption = ports.encryption()
            if (!encryption) return failure({ error: "encryption_unavailable" })
            const reserved = await ports.reserveTest(guildId, command.ref)
            if (isFailure(reserved)) return failure(reserved)
            const binding = reserved.binding
            if (!binding) return failure({ error: "not_found" })
            if (credentialRequirement(binding.provider) === "forbidden")
                return failure({ error: "key_not_allowed" })
            const source: DataSource = {
                ref: command.ref,
                guildId,
                gameId: binding.gameId,
                provider: binding.provider,
                origin: binding.origin,
                providerServerId: binding.providerServerId,
                secretRef: null,
                // An operator network exception is for the Convex network, not
                // this server's: a key for such a source is verified there with
                // `test_stored` after an explicitly unverified save.
                allowedAddresses: [],
            }
            const test = await ports.testConnection(source, plaintext)
            const verified = test.outcome === "ok"
            if (!verified && !command.allowUnverified)
                return json(
                    { error: "verification_required", test: testBody(test) },
                    422
                )
            const result = await ports.setCredential(guildId, {
                ref: command.ref,
                expectedRevision: command.expectedRevision,
                binding: {
                    provider: binding.provider,
                    origin: binding.origin,
                    providerServerId: binding.providerServerId,
                },
                credential: encryption.encrypt(
                    {
                        guildId,
                        sourceRef: command.ref,
                        provider: binding.provider,
                        origin: binding.origin,
                        providerServerId: binding.providerServerId,
                    },
                    plaintext
                ),
                verified,
                testOutcome: test.outcome,
            })
            return isFailure(result)
                ? failure(result)
                : json({ ...result, test: testBody(test) })
        }

        // A draft: a new reference, the canonical origin, no operator fields.
        const sourceRef = ports.newRef()
        const built = draftSource(command.draft, { guildId, ref: sourceRef })
        if (!built.ok) return failure({ error: "invalid_source" })
        const requirement = credentialRequirement(built.source.provider)
        if (requirement === "required" && plaintext === null)
            return failure({ error: "key_required" })
        if (requirement === "forbidden" && plaintext !== null)
            return failure({ error: "key_not_allowed" })
        const encryption = plaintext === null ? null : ports.encryption()
        if (plaintext !== null && !encryption && command.action === "create")
            return failure({ error: "encryption_unavailable" })
        const shouldTest = command.action === "test" || command.enable
        let test: ConnectionTestResult | null = null
        if (shouldTest) {
            const reserved = await ports.reserveTest(guildId, null)
            if (isFailure(reserved)) return failure(reserved)
            test = await ports.testConnection(built.source, plaintext)
        }
        if (command.action === "test") return json(testBody(test!))
        const verified = test?.outcome === "ok"
        const result = await ports.create(guildId, {
            source: {
                ref: sourceRef,
                displayName: command.draft.displayName,
                gameId: built.source.gameId,
                provider: built.source.provider,
                origin: built.source.origin,
                providerServerId: built.source.providerServerId,
            },
            credential:
                plaintext !== null && encryption
                    ? encryption.encrypt(
                          {
                              guildId,
                              sourceRef,
                              provider: built.source.provider,
                              origin: built.source.origin,
                              providerServerId: built.source.providerServerId,
                          },
                          plaintext
                      )
                    : null,
            verified,
            testOutcome: test?.outcome ?? null,
            // Enabled only after a passing test; otherwise a disabled draft.
            enable: command.enable && verified,
        })
        return isFailure(result)
            ? failure(result)
            : json({ ...result, ...(test ? { test: testBody(test) } : {}) })
    }

    return {
        async GET(serverId: string): Promise<Response> {
            const scope = await ports.authorize(serverId)
            if (!scope) return json({ error: "forbidden" }, 403)
            try {
                const list = (await ports.list(scope.guildId)) as object
                return json(
                    gameServerSourceListSchema.parse({
                        ...list,
                        encryption: ports.encryption()
                            ? "active"
                            : "unavailable",
                    })
                )
            } catch {
                return failure({ error: "unavailable" })
            }
        },
        async POST(request: Request, serverId: string): Promise<Response> {
            // Browser writes must come from this site; a missing Origin is refused too.
            if (request.headers.get("origin") !== new URL(request.url).origin)
                return json({ error: "forbidden" }, 403)
            const scope = await ports.authorize(serverId)
            if (!scope) return json({ error: "forbidden" }, 403)
            let body: unknown
            try {
                body = await readBoundedJson(request, SOURCE_COMMAND_MAX_BYTES)
            } catch {
                return failure({ error: "invalid_source" })
            }
            try {
                return await run(scope.guildId, body)
            } catch {
                // Never echo an exception: it could carry request data.
                return failure({ error: "unavailable" })
            }
        },
    }
}
