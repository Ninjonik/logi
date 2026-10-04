import {
    decideTeamArchive,
    decideTeamCreate,
    decideTeamMerge,
    decideTeamRestore,
    decideTeamUpdate,
    normalizeTeamName,
    teamCreateFingerprint,
    teamCreateSchema,
    teamLifecycleSchema,
    teamMergeSchema,
    teamUpdateSchema,
    type TeamCommandError,
} from "../../domain/teams/team"
import type { TeamDirectoryRepository, TeamLogoPort } from "./ports"

export type TeamDirectoryPorts = {
    repository: TeamDirectoryRepository
    logos: TeamLogoPort
    /** ISO timestamp for this write. */
    now(): string
}
/** The already authorized global administrator performing the write. */
export type TeamDirectoryActor = { actor: string }
export type TeamCommandFailure = {
    error: TeamCommandError
    existingId?: string
}
const fail = (
    error: TeamCommandError,
    existingId?: string
): TeamCommandFailure => ({ error, ...(existingId ? { existingId } : {}) })

async function resolveLogo(
    logos: TeamLogoPort,
    assetId: string | null
): Promise<{ id: string | null } | TeamCommandFailure> {
    if (!assetId) return { id: null }
    const id = await logos.attachable(assetId)
    return id ? { id } : fail("asset_unavailable")
}

/**
 * Idempotent create: a retried key with the same payload replays the original
 * result; the same key with another payload is a conflict. The record, its
 * logo reference, audit entry and change records are written together.
 */
export async function createTeam(
    ports: TeamDirectoryPorts,
    scope: TeamDirectoryActor,
    raw: unknown
): Promise<
    | { ok: true; teamId: string; revision: number; replayed: boolean }
    | TeamCommandFailure
> {
    const parsed = teamCreateSchema.safeParse(raw)
    if (!parsed.success) return fail("invalid_team")
    const input = parsed.data,
        fingerprint = teamCreateFingerprint(input)
    const replay = await ports.repository.findCreate(input.idempotencyKey)
    if (replay)
        return replay.fingerprint === fingerprint
            ? {
                  ok: true,
                  teamId: replay.teamId,
                  revision: replay.revision,
                  replayed: true,
              }
            : fail("idempotency_conflict")
    const existing = await ports.repository.findByNormalizedName(
        input.gameId,
        normalizeTeamName(input.name)
    )
    const decision = decideTeamCreate({
        input,
        existing: existing
            ? { id: existing.id, archivedAt: existing.archivedAt }
            : null,
        count: await ports.repository.count(input.gameId),
        now: ports.now(),
    })
    if (!decision.ok) return fail(decision.error, decision.existingId)
    const logo = await resolveLogo(ports.logos, decision.team.logoAssetId)
    if ("error" in logo) return logo
    const team = await ports.repository.insert(
        { ...decision.team, logoAssetId: logo.id },
        scope.actor
    )
    await ports.logos.syncReferences(team.id, logo.id ? [logo.id] : [])
    await ports.repository.audit(team, "create", scope.actor, {
        idempotencyKey: input.idempotencyKey,
        fingerprint,
    })
    await ports.repository.emit(team, "upsert")
    return {
        ok: true,
        teamId: team.id,
        revision: team.revision,
        replayed: false,
    }
}

/** Revision-checked edit; a rename rechecks uniqueness and a new logo rechecks ownership. */
export async function updateTeam(
    ports: TeamDirectoryPorts,
    scope: TeamDirectoryActor,
    teamId: string,
    raw: unknown
): Promise<{ ok: true; revision: number } | TeamCommandFailure> {
    const parsed = teamUpdateSchema.safeParse(raw)
    if (!parsed.success) return fail("invalid_team")
    const team = await ports.repository.get(teamId)
    if (!team) return fail("not_found")
    const conflicting = await ports.repository.findByNormalizedName(
        team.gameId,
        normalizeTeamName(parsed.data.name ?? team.name)
    )
    const decision = decideTeamUpdate({
        team,
        input: parsed.data,
        conflicting: conflicting ? { id: conflicting.id } : null,
        now: ports.now(),
    })
    if (!decision.ok) return fail(decision.error, decision.existingId)
    // An unchanged logo was verified when it was attached.
    const logo =
        decision.patch.logoAssetId === team.logoAssetId
            ? { id: team.logoAssetId }
            : await resolveLogo(ports.logos, decision.patch.logoAssetId)
    if ("error" in logo) return logo
    const updated = await ports.repository.update(
        team,
        { ...decision.patch, logoAssetId: logo.id },
        scope.actor
    )
    // A replaced logo loses this reference; a match snapshot may still keep the asset alive.
    await ports.logos.syncReferences(team.id, logo.id ? [logo.id] : [])
    await ports.repository.audit(updated, "update", scope.actor)
    await ports.repository.emit(updated, "upsert")
    return { ok: true, revision: updated.revision }
}

/**
 * Archive hides a team from new selection and the website catalogue (a
 * `remove` change); restore brings the same entry back (`upsert`). A merged
 * team cannot be restored. History keeps its snapshots either way.
 */
export async function changeTeamLifecycle(
    ports: TeamDirectoryPorts,
    scope: TeamDirectoryActor,
    teamId: string,
    raw: unknown,
    operation: "archive" | "restore"
): Promise<{ ok: true; revision: number } | TeamCommandFailure> {
    const parsed = teamLifecycleSchema.safeParse(raw)
    if (!parsed.success) return fail("invalid_team")
    const team = await ports.repository.get(teamId)
    if (!team) return fail("not_found")
    if (operation === "restore" && team.mergedIntoTeamId)
        return fail("invalid_merge")
    if (operation === "restore") {
        // Another active team may have taken the name while this one was archived.
        const conflicting = await ports.repository.findByNormalizedName(
            team.gameId,
            team.normalizedName
        )
        if (
            conflicting &&
            conflicting.id !== team.id &&
            !conflicting.archivedAt
        )
            return fail("duplicate_name", conflicting.id)
    }
    const decide =
        operation === "archive" ? decideTeamArchive : decideTeamRestore
    const decision = decide({ team, input: parsed.data, now: ports.now() })
    if (!decision.ok) return fail(decision.error)
    const updated = await ports.repository.update(
        team,
        decision.patch,
        scope.actor
    )
    await ports.repository.audit(updated, operation, scope.actor)
    await ports.repository.emit(
        updated,
        operation === "archive" ? "remove" : "upsert"
    )
    return { ok: true, revision: updated.revision }
}

/**
 * Merges a duplicate into the team that stays: the source is archived with a
 * merge pointer, and its competition registrations, fixtures and pending
 * requests move to the target. Saved match snapshots are not rewritten.
 */
export async function mergeTeam(
    ports: TeamDirectoryPorts,
    scope: TeamDirectoryActor,
    sourceTeamId: string,
    raw: unknown
): Promise<
    { ok: true; revision: number; targetRevision: number } | TeamCommandFailure
> {
    const parsed = teamMergeSchema.safeParse(raw)
    if (!parsed.success) return fail("invalid_team")
    const source = await ports.repository.get(sourceTeamId)
    if (!source) return fail("not_found")
    const target = await ports.repository.get(parsed.data.targetTeamId)
    const decision = decideTeamMerge({
        source,
        target,
        input: parsed.data,
        now: ports.now(),
    })
    if (!decision.ok || !target)
        return fail(decision.ok ? "not_found" : decision.error)
    const wasActive = source.archivedAt === null
    const merged = await ports.repository.update(
        source,
        decision.source,
        scope.actor
    )
    const kept = await ports.repository.update(
        target,
        decision.target,
        scope.actor
    )
    await ports.repository.repoint(source.id, target.id)
    await ports.repository.audit(merged, "merge", scope.actor, {
        mergedIntoTeamId: target.id,
    })
    if (wasActive) await ports.repository.emit(merged, "remove")
    await ports.repository.emit(kept, "upsert")
    return {
        ok: true,
        revision: merged.revision,
        targetRevision: kept.revision,
    }
}
