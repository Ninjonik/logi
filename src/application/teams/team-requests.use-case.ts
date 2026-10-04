import {
    changeRequestTargetError,
    requestTransitionError,
    TEAM_REQUEST_PENDING_LIMIT,
    teamRequestDecisionSchema,
    teamRequestFingerprint,
    teamRequestSubmitSchema,
    type TeamRequestEntity,
    type TeamRequestError,
} from "../../domain/teams/team-request"
import {
    decideTeamCreate,
    decideTeamUpdate,
    normalizeTeamName,
    type TeamCommandError,
} from "../../domain/teams/team"
import type {
    TeamDirectoryRepository,
    TeamLogoPort,
    TeamRequestLogoPort,
    TeamRequestRepository,
} from "./ports"

export type TeamRequestPorts = {
    requests: TeamRequestRepository
    requestLogos: TeamRequestLogoPort
    directory: TeamDirectoryRepository
    logos: TeamLogoPort
    now(): string
}
export type TeamRequestFailure = {
    error: TeamRequestError | TeamCommandError
    existingId?: string
}
const fail = (
    error: TeamRequestError | TeamCommandError,
    existingId?: string
): TeamRequestFailure => ({ error, ...(existingId ? { existingId } : {}) })

/**
 * A workspace administrator's submission. Idempotent per workspace and key; a
 * change request must target an active team, whose game it inherits.
 */
export async function submitTeamRequest(
    ports: TeamRequestPorts,
    scope: { guildId: string; actor: string },
    raw: unknown
): Promise<
    { ok: true; requestId: string; replayed: boolean } | TeamRequestFailure
> {
    const parsed = teamRequestSubmitSchema.safeParse(raw)
    if (!parsed.success) return fail("invalid_request")
    const input = parsed.data,
        fingerprint = teamRequestFingerprint(input)
    const replay = await ports.requests.findSubmission(
        scope.guildId,
        input.idempotencyKey
    )
    if (replay)
        return replay.fingerprint === fingerprint
            ? { ok: true, requestId: replay.requestId, replayed: true }
            : fail("idempotency_conflict")
    if (
        (await ports.requests.countPending(scope.guildId)) >=
        TEAM_REQUEST_PENDING_LIMIT
    )
        return fail("limit_reached")
    let gameId = input.kind === "create" ? input.gameId : null
    let teamId: string | null = null
    if (input.kind === "update") {
        const team = await ports.directory.get(input.teamId)
        const denied = changeRequestTargetError(team)
        if (denied || !team) return fail(denied ?? "not_found")
        gameId = team.gameId
        teamId = team.id
    }
    if (!gameId) return fail("invalid_request")
    const logo = input.proposal.logoAssetId
        ? await ports.requestLogos.attachable(
              scope.guildId,
              input.proposal.logoAssetId
          )
        : null
    if (input.proposal.logoAssetId && !logo) return fail("asset_unavailable")
    const now = ports.now()
    const request = await ports.requests.insert({
        guildId: scope.guildId,
        requestedBy: scope.actor,
        kind: input.kind,
        gameId,
        teamId,
        proposal: { ...input.proposal, logoAssetId: logo },
        note: input.note,
        createdAt: now,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
    })
    await ports.requestLogos.syncReferences(
        scope.guildId,
        request.id,
        logo ? [logo] : []
    )
    return { ok: true, requestId: request.id, replayed: false }
}

/** The requester's workspace withdraws a pending request; no DM is sent. */
export async function cancelTeamRequest(
    ports: TeamRequestPorts,
    scope: { guildId: string },
    requestId: string
): Promise<{ ok: true } | TeamRequestFailure> {
    const request = await ports.requests.get(requestId)
    if (!request || request.guildId !== scope.guildId) return fail("not_found")
    const denied = requestTransitionError(request)
    if (denied) return fail(denied)
    await ports.requests.decide(request, {
        status: "cancelled",
        reason: null,
        resultTeamId: null,
        decidedBy: null,
        decidedAt: ports.now(),
        notify: false,
    })
    await ports.requestLogos.syncReferences(request.guildId, request.id, [])
    return { ok: true }
}

async function finish(
    ports: TeamRequestPorts,
    request: TeamRequestEntity,
    outcome: {
        status: "approved" | "merged" | "rejected"
        reason: string | null
        resultTeamId: string | null
        actor: string
    }
) {
    await ports.requests.decide(request, {
        status: outcome.status,
        reason: outcome.reason,
        resultTeamId: outcome.resultTeamId,
        decidedBy: outcome.actor,
        decidedAt: ports.now(),
        notify: true,
    })
    // The approved logo is now referenced by the team; the request lets go of it.
    await ports.requestLogos.syncReferences(request.guildId, request.id, [])
}

/**
 * A global administrator's decision on a pending request. Approval may use an
 * edited proposal; it creates the team, or applies the fields to the target at
 * the revision the administrator reviewed. Every decision queues one DM.
 */
export async function decideTeamRequest(
    ports: TeamRequestPorts,
    scope: { actor: string },
    requestId: string,
    raw: unknown
): Promise<
    { ok: true; status: string; teamId: string | null } | TeamRequestFailure
> {
    const parsed = teamRequestDecisionSchema.safeParse(raw)
    if (!parsed.success) return fail("invalid_decision")
    const request = await ports.requests.get(requestId)
    if (!request) return fail("not_found")
    const denied = requestTransitionError(request)
    if (denied) return fail(denied)
    const decision = parsed.data

    if (decision.decision === "reject") {
        await finish(ports, request, {
            status: "rejected",
            reason: decision.reason,
            resultTeamId: null,
            actor: scope.actor,
        })
        return { ok: true, status: "rejected", teamId: null }
    }

    if (decision.decision === "merge") {
        if (request.kind !== "create") return fail("invalid_decision")
        const target = await ports.directory.get(decision.targetTeamId)
        if (!target) return fail("not_found")
        if (target.archivedAt) return fail("team_archived")
        if (target.gameId !== request.gameId) return fail("team_game_mismatch")
        await finish(ports, request, {
            status: "merged",
            reason: null,
            resultTeamId: target.id,
            actor: scope.actor,
        })
        return { ok: true, status: "merged", teamId: target.id }
    }

    const proposal = decision.proposal ?? request.proposal
    // A logo the administrator replaced must already belong to the platform;
    // the requester's own logo moves from the workspace to the platform.
    let logo: string | null = null
    if (proposal.logoAssetId) {
        logo =
            proposal.logoAssetId === request.proposal.logoAssetId
                ? await ports.logos.adopt(proposal.logoAssetId, request.guildId)
                : await ports.logos.attachable(proposal.logoAssetId)
        if (!logo) return fail("asset_unavailable")
    }
    const now = ports.now()

    if (request.kind === "create") {
        const existing = await ports.directory.findByNormalizedName(
            request.gameId,
            normalizeTeamName(proposal.name)
        )
        const created = decideTeamCreate({
            input: {
                gameId: request.gameId,
                name: proposal.name,
                shortCode: proposal.shortCode,
                logoAssetId: logo,
                description: proposal.description,
                links: proposal.links,
                linkedGuildId: null,
                idempotencyKey: `request-${request.id}`,
            },
            existing: existing
                ? { id: existing.id, archivedAt: existing.archivedAt }
                : null,
            count: await ports.directory.count(request.gameId),
            now,
        })
        if (!created.ok) return fail(created.error, created.existingId)
        const team = await ports.directory.insert(created.team, scope.actor)
        await ports.logos.syncReferences(team.id, logo ? [logo] : [])
        await ports.directory.audit(team, "request_approved", scope.actor, {
            requestId: request.id,
        })
        await ports.directory.emit(team, "upsert")
        await finish(ports, request, {
            status: "approved",
            reason: null,
            resultTeamId: team.id,
            actor: scope.actor,
        })
        return { ok: true, status: "approved", teamId: team.id }
    }

    const team = request.teamId
        ? await ports.directory.get(request.teamId)
        : null
    const targetDenied = changeRequestTargetError(team)
    if (targetDenied || !team) return fail(targetDenied ?? "not_found")
    const conflicting = await ports.directory.findByNormalizedName(
        team.gameId,
        normalizeTeamName(proposal.name)
    )
    const updated = decideTeamUpdate({
        team,
        input: {
            expectedRevision: decision.targetRevision ?? team.revision,
            name: proposal.name,
            shortCode: proposal.shortCode,
            logoAssetId: logo,
            description: proposal.description,
            links: proposal.links,
        },
        conflicting: conflicting ? { id: conflicting.id } : null,
        now,
    })
    if (!updated.ok) return fail(updated.error, updated.existingId)
    const saved = await ports.directory.update(team, updated.patch, scope.actor)
    await ports.logos.syncReferences(team.id, logo ? [logo] : [])
    await ports.directory.audit(saved, "request_approved", scope.actor, {
        requestId: request.id,
    })
    await ports.directory.emit(saved, "upsert")
    await finish(ports, request, {
        status: "approved",
        reason: null,
        resultTeamId: saved.id,
        actor: scope.actor,
    })
    return { ok: true, status: "approved", teamId: saved.id }
}
