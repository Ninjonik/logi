"use node"

import {
    migrateLegacyCredentials,
    reencryptCredentials,
    type MigrationResult,
    type ReencryptionReport,
} from "../src/application/game-data/migrate-credentials"
import {
    CredentialCipherError,
    decryptCredential,
    encryptCredential,
    parseKeyring,
    type Keyring,
} from "../src/infrastructure/game-data/credential-cipher"
import { providerCredential } from "../src/infrastructure/game-data/credential-resolver"
import { testProviderConnection } from "../src/infrastructure/game-data/connection-test"
import { createProviderHttp } from "../src/infrastructure/game-data/provider-http"
import type { ConnectionTestOutcome } from "../src/domain/game-data/credentials"
import { action, internalAction } from "./_generated/server"
import type { StoredTestResult } from "./gameDataSources"
import { dashboardActor } from "./dashboardActor"
import { internal } from "./_generated/api"
import { v } from "convex/values"

/** This runtime's keyring, or null when it is missing or invalid. */
function runtimeKeyring(): Keyring | null {
    try {
        return parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING)
    } catch (error) {
        if (error instanceof CredentialCipherError) return null
        throw error
    }
}

/**
 * Tests a stored key without it leaving Convex: the internal reservation
 * authorizes the administrator and spends the test quota, this action decrypts
 * just before one read-only request and records only the outcome.
 */
export const testStored = action({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        ref: v.string(),
    },
    handler: async (ctx, args): Promise<StoredTestResult> => {
        const reserved = await ctx.runMutation(
            internal.gameDataSources.reserveStoredTest,
            args
        )
        if ("error" in reserved) return reserved
        const { source, envelope, credentialVersion } = reserved
        let keyFailed = false
        const credential = providerCredential(source, {
            env: (name) => process.env[name],
            keyring: () => process.env.LOGI_CREDENTIAL_KEYRING,
            loadEnvelope: async () => envelope,
            reportFailure: async () => {
                keyFailed = true
            },
        })
        const result = await testProviderConnection(
            source,
            createProviderHttp(source, { credential, now: Date.now }),
            { keyed: Boolean(credential), now: Date.now }
        )
        const outcome: ConnectionTestOutcome =
            keyFailed && result.outcome === "configuration"
                ? "key_unavailable"
                : result.outcome
        await ctx.runMutation(internal.gameDataSources.recordStoredTest, {
            guildId: args.guildId,
            ref: args.ref,
            credentialVersion,
            outcome,
        })
        return { ...result, outcome }
    },
})

/**
 * Operator command: moves environment-variable keys into encrypted
 * credentials. Run with `dryRun: true` first; see the credentials runbook.
 */
export const migrateLegacy = internalAction({
    args: {
        dryRun: v.boolean(),
        phase: v.union(v.literal("operator"), v.literal("workspace")),
        cursor: v.optional(v.union(v.string(), v.null())),
        limit: v.optional(v.number()),
        guildId: v.optional(v.string()),
        ref: v.optional(v.string()),
        confirmWorkspaceBinding: v.optional(v.boolean()),
    },
    handler: async (
        ctx,
        args
    ): Promise<{
        phase: "operator" | "workspace"
        results: MigrationResult[]
        nextCursor: string | null
    }> => {
        const keyring = runtimeKeyring()
        return migrateLegacyCredentials(
            {
                candidates: (input) =>
                    ctx.runQuery(
                        internal.gameDataCredentialMigration.legacyCandidates,
                        input
                    ),
                readVariable: (name) => process.env[name],
                encrypter: () =>
                    keyring
                        ? (plaintext, aad) =>
                              encryptCredential(keyring, plaintext, aad)
                        : null,
                adopt: (candidate, envelope) =>
                    ctx.runMutation(
                        internal.gameDataCredentialMigration
                            .adoptLegacyCredential,
                        {
                            kind: candidate.kind,
                            guildId: candidate.guildId,
                            ref: candidate.ref,
                            secretRef: candidate.secretRef,
                            expectedRevision: candidate.expectedRevision,
                            envelope,
                        }
                    ),
            },
            {
                ...args,
                cursor: args.cursor ?? null,
                limit: args.limit ?? 50,
            }
        )
    },
})

/**
 * Operator command after adding a new current key to the keyring: re-encrypts
 * one page of credentials still under an older key.
 */
export const reencrypt = internalAction({
    args: {
        dryRun: v.boolean(),
        cursor: v.optional(v.union(v.string(), v.null())),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<ReencryptionReport> => {
        const keyring = runtimeKeyring()
        return reencryptCredentials(
            {
                page: (input) =>
                    ctx.runQuery(
                        internal.gameDataCredentialMigration.credentialsPage,
                        input
                    ),
                keyring: () =>
                    keyring
                        ? {
                              current: keyring.current,
                              decrypt: (envelope, aad) =>
                                  decryptCredential(keyring, envelope, aad),
                              encrypt: (plaintext, aad) =>
                                  encryptCredential(keyring, plaintext, aad),
                          }
                        : null,
                replace: (item, envelope) =>
                    ctx.runMutation(
                        internal.gameDataCredentialMigration.replaceCiphertext,
                        {
                            id: item.id,
                            expectedVersion: item.version,
                            expectedNonce: item.envelope.nonce,
                            envelope,
                        }
                    ),
            },
            {
                dryRun: args.dryRun,
                cursor: args.cursor ?? null,
                limit: args.limit ?? 50,
            }
        )
    },
})
