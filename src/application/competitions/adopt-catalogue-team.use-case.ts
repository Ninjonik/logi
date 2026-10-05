import {
    decideTeamCreate,
    linkedGuildIdSchema,
    normalizeTeamName,
    teamCreateSchema,
    type TeamGame,
} from "../../domain/teams/team"
import type { TeamDirectoryRepository } from "../teams/ports"

export type AdoptCatalogueTeamPorts = {
    repository: TeamDirectoryRepository
    /** ISO timestamp for this write. */
    now(): string
}
export type AdoptCatalogueTeamResult =
    | { ok: true; teamId: string; created: boolean; linked: boolean }
    | { error: "invalid_team" | "limit_reached" }

/** Not persisted: adoption is idempotent by name, not by a client retry key. */
const ADOPTION_KEY = "competition-adoption"

/**
 * Finds the global catalogue team of this game with the same normalized name
 * (an active entry before an archived one, never a merged one) or creates it.
 * Used by the competition seed and the legacy migration, which run without a
 * client and must never create a second team for one name.
 *
 * `linkedGuildId` records the Logi workspace the team represents: a new team
 * gets it, and a found active team without a link gains it. An existing link
 * is never replaced and linking grants no permissions.
 */
export async function adoptCatalogueTeam(
    ports: AdoptCatalogueTeamPorts,
    actor: string,
    input: { gameId: TeamGame; name: string; linkedGuildId: string | null }
): Promise<AdoptCatalogueTeamResult> {
    const linkedGuildId = linkedGuildIdSchema.safeParse(input.linkedGuildId)
        .success
        ? input.linkedGuildId
        : null
    const parsed = teamCreateSchema.safeParse({
        gameId: input.gameId,
        name: input.name,
        linkedGuildId,
        idempotencyKey: ADOPTION_KEY,
    })
    if (!parsed.success) return { error: "invalid_team" }
    const existing = await ports.repository.findByNormalizedName(
        parsed.data.gameId,
        normalizeTeamName(parsed.data.name)
    )
    if (existing) {
        if (!linkedGuildId || existing.linkedGuildId || existing.archivedAt)
            return {
                ok: true,
                teamId: existing.id,
                created: false,
                linked: false,
            }
        const updated = await ports.repository.update(
            existing,
            {
                linkedGuildId,
                revision: existing.revision + 1,
                updatedAt: ports.now(),
            },
            actor
        )
        await ports.repository.audit(updated, "update", actor)
        await ports.repository.emit(updated, "upsert")
        return { ok: true, teamId: updated.id, created: false, linked: true }
    }
    const decision = decideTeamCreate({
        input: parsed.data,
        existing: null,
        count: await ports.repository.count(parsed.data.gameId),
        now: ports.now(),
    })
    if (!decision.ok)
        return {
            error:
                decision.error === "limit_reached"
                    ? "limit_reached"
                    : "invalid_team",
        }
    const team = await ports.repository.insert(decision.team, actor)
    await ports.repository.audit(team, "create", actor)
    await ports.repository.emit(team, "upsert")
    return {
        ok: true,
        teamId: team.id,
        created: true,
        linked: linkedGuildId !== null,
    }
}
