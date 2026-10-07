import {
    credentialAad,
    type CredentialBinding,
    type CredentialEnvelope,
    type DataProvider,
} from "../../domain/game-data/credentials"
import { providerKeySchema } from "../../domain/game-data/credentials.schema"

export type LegacyCandidate = {
    kind: "operator" | "workspace"
    guildId: string
    ref: string
    provider: DataProvider
    origin: string
    providerServerId: string
    secretRef: string
    expectedRevision: number
    conflict: boolean
    networkException: boolean
}
export type MigrationStatus =
    | "would_migrate"
    | "migrated"
    | "already_encrypted"
    | "stale"
    | "missing_variable"
    | "invalid_variable"
    | "conflict"
    | "needs_confirmation"
    | "encryption_unavailable"
/** One line of the report: names and outcomes only, never a value. */
export type MigrationResult = {
    kind: LegacyCandidate["kind"]
    guildId: string
    ref: string
    provider: DataProvider
    host: string
    variable: string
    networkExceptionDropped: boolean
    status: MigrationStatus
}
export type MigrationPorts = {
    candidates(input: {
        phase: LegacyCandidate["kind"]
        cursor: string | null
        limit: number
        guildId?: string
        ref?: string
    }): Promise<{ candidates: LegacyCandidate[]; nextCursor: string | null }>
    /** Reads exactly the named variable; the environment is never enumerated. */
    readVariable(name: string): string | undefined
    /** Null when the keyring is missing or invalid. */
    encrypter(): ((plaintext: string, aad: string) => CredentialEnvelope) | null
    adopt(
        candidate: LegacyCandidate,
        envelope: CredentialEnvelope
    ): Promise<
        Exclude<
            MigrationStatus,
            | "would_migrate"
            | "missing_variable"
            | "invalid_variable"
            | "conflict"
            | "needs_confirmation"
        >
    >
}

/**
 * Operator migration of environment-variable keys into encrypted credentials,
 * one bounded page at a time. A dry run reports what would happen. Operator
 * catalog entries migrate in bulk; a workspace registration named its variable
 * itself, so it migrates only when the operator selects that exact workspace
 * and reference and confirms the variable belongs to it. A variable another
 * workspace also names is never migrated.
 */
export async function migrateLegacyCredentials(
    ports: MigrationPorts,
    input: {
        dryRun: boolean
        phase: LegacyCandidate["kind"]
        cursor: string | null
        limit: number
        guildId?: string
        ref?: string
        confirmWorkspaceBinding?: boolean
    }
): Promise<{
    phase: LegacyCandidate["kind"]
    results: MigrationResult[]
    nextCursor: string | null
}> {
    // A selected registration is read directly, wherever it would page.
    const page = await ports.candidates({
        phase: input.phase,
        cursor: input.cursor,
        limit: input.limit,
        ...(input.guildId && input.ref
            ? { guildId: input.guildId, ref: input.ref }
            : {}),
    })
    const encrypt = ports.encrypter()
    const results: MigrationResult[] = []
    for (const candidate of page.candidates) {
        if (
            (input.guildId && candidate.guildId !== input.guildId) ||
            (input.ref && candidate.ref !== input.ref)
        )
            continue
        const report = (status: MigrationStatus): MigrationResult => ({
            kind: candidate.kind,
            guildId: candidate.guildId,
            ref: candidate.ref,
            provider: candidate.provider,
            host: new URL(candidate.origin).host,
            variable: candidate.secretRef,
            networkExceptionDropped: candidate.networkException,
            status,
        })
        if (candidate.conflict) {
            results.push(report("conflict"))
            continue
        }
        const raw = ports.readVariable(candidate.secretRef)
        if (raw === undefined || raw === "") {
            results.push(report("missing_variable"))
            continue
        }
        const key = providerKeySchema.safeParse(raw)
        if (!key.success) {
            results.push(report("invalid_variable"))
            continue
        }
        if (
            candidate.kind === "workspace" &&
            !(input.confirmWorkspaceBinding && input.guildId && input.ref)
        ) {
            results.push(report("needs_confirmation"))
            continue
        }
        if (!encrypt) {
            results.push(report("encryption_unavailable"))
            continue
        }
        if (input.dryRun) {
            results.push(report("would_migrate"))
            continue
        }
        const binding: CredentialBinding = {
            guildId: candidate.guildId,
            sourceRef: candidate.ref,
            provider: candidate.provider,
            origin: candidate.origin,
            providerServerId: candidate.providerServerId,
        }
        results.push(
            report(
                await ports.adopt(
                    candidate,
                    encrypt(key.data, credentialAad(binding))
                )
            )
        )
    }
    return { phase: input.phase, results, nextCursor: page.nextCursor }
}

export type StoredCredential = {
    id: string
    guildId: string
    sourceRef: string
    version: number
    envelope: CredentialEnvelope
    binding: Omit<CredentialBinding, "guildId" | "sourceRef"> | null
}
export type ReencryptionPorts = {
    page(input: {
        cursor: string | null
        limit: number
    }): Promise<{ items: StoredCredential[]; nextCursor: string | null }>
    /** Null when the keyring is missing or invalid. */
    keyring(): {
        current: string
        decrypt(envelope: CredentialEnvelope, aad: string): string
        encrypt(plaintext: string, aad: string): CredentialEnvelope
    } | null
    replace(
        item: StoredCredential,
        envelope: CredentialEnvelope
    ): Promise<"reencrypted" | "stale" | "encryption_unavailable">
}
export type ReencryptionReport = {
    examined: number
    current: number
    reencrypted: number
    pending: number
    failures: Array<{
        guildId: string
        ref: string
        reason: "orphaned" | "unreadable" | "stale" | "encryption_unavailable"
    }>
    nextCursor: string | null
}

/**
 * Re-encrypts one bounded page of credentials under the current keyring key.
 * Resumable by cursor and idempotent; an old key may be retired only after a
 * complete pass reports nothing pending and no failures.
 */
export async function reencryptCredentials(
    ports: ReencryptionPorts,
    input: { dryRun: boolean; cursor: string | null; limit: number }
): Promise<ReencryptionReport> {
    const keyring = ports.keyring()
    const page = await ports.page(input)
    const report: ReencryptionReport = {
        examined: 0,
        current: 0,
        reencrypted: 0,
        pending: 0,
        failures: [],
        nextCursor: page.nextCursor,
    }
    for (const item of page.items) {
        report.examined++
        const fail = (
            reason: ReencryptionReport["failures"][number]["reason"]
        ) =>
            report.failures.push({
                guildId: item.guildId,
                ref: item.sourceRef,
                reason,
            })
        if (!keyring) {
            fail("encryption_unavailable")
            continue
        }
        if (item.envelope.keyId === keyring.current) {
            report.current++
            continue
        }
        if (!item.binding) {
            fail("orphaned")
            continue
        }
        const aad = credentialAad({
            ...item.binding,
            guildId: item.guildId,
            sourceRef: item.sourceRef,
        })
        let plaintext: string
        try {
            plaintext = keyring.decrypt(item.envelope, aad)
        } catch {
            fail("unreadable")
            continue
        }
        if (input.dryRun) {
            report.pending++
            continue
        }
        const outcome = await ports.replace(
            item,
            keyring.encrypt(plaintext, aad)
        )
        if (outcome === "reencrypted") report.reencrypted++
        else fail(outcome)
    }
    return report
}
