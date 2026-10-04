import {
    matchTeamInputsSchema,
    matchTeamsEditability,
    refreshMatchTeamSnapshot,
    resolveMatchTeams,
    validatePreservedMatchTeams,
    type MatchTeamAssignment,
    type MatchTeamError,
} from "../src/domain/teams/match-teams"
import { directoryLookup, recordTeamAudit, teamById } from "./teams"
import { currentEventStatus } from "../src/domain/events/status"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { getGuildById, getGuildDiscordId } from "./identity"
import { teamGameSchema } from "../src/domain/teams/team"
import type { Doc, Id } from "./_generated/dataModel"
import { syncAssetReferences } from "./imageAssets"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

const INTERNAL_AUTH_SECRET =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"

export type MatchTeamResolution =
    | { ok: true; matchTeams: MatchTeamAssignment[] | undefined }
    | { ok: false; error: MatchTeamError }

const canonical = (
    entries: readonly { teamId: string; slot: string; side: string | null }[]
) =>
    JSON.stringify(
        [...entries]
            .map(({ teamId, slot, side }) => ({ teamId, slot, side }))
            .sort((a, b) => a.slot.localeCompare(b.slot))
    )

/**
 * Authoritative resolution for an event save. Omitted input preserves the
 * current assignments (re-validated after a game change); an explicit list
 * is resolved against active directory entries, keeping existing snapshots.
 * An explicit [] on an unconcluded match stores [] ("no teams selected"); an
 * event that never stored a selection keeps none (null in summaries). Callers
 * pass the schedule-derived `currentEventStatus`, so a match past its end is
 * frozen before the stored status catches up. A training never
 * carries assignments: an unconcluded match that becomes one drops them, which
 * also releases their logo references.
 */
export async function resolveEventMatchTeams(
    ctx: Pick<QueryCtx, "db">,
    input: {
        guildId: string
        gameId: string | undefined
        kind: "match" | "training" | undefined
        status: Doc<"events">["status"]
        inputs: unknown
        previous: MatchTeamAssignment[] | undefined
        now: string
    }
): Promise<MatchTeamResolution> {
    const game = teamGameSchema.safeParse(input.gameId ?? "hell_let_loose")
    const training = (input.kind ?? "match") === "training"
    const concluded = input.status === "concluded"
    if (input.inputs === undefined) {
        if (!input.previous?.length)
            return { ok: true, matchTeams: input.previous }
        if (training)
            return { ok: true, matchTeams: concluded ? input.previous : [] }
        if (!game.success) return { ok: false, error: "team_game_mismatch" }
        const denied = validatePreservedMatchTeams({
            gameId: game.data,
            assignments: input.previous,
            teams: await directoryLookup(
                ctx,
                input.guildId,
                input.previous.map((entry) => entry.teamId)
            ),
        })
        return denied
            ? { ok: false, error: denied }
            : { ok: true, matchTeams: input.previous }
    }
    const parsed = matchTeamInputsSchema.safeParse(input.inputs)
    if (!parsed.success) return { ok: false, error: "invalid_match_teams" }
    if (parsed.data.length === 0 && !input.previous?.length)
        return {
            ok: true,
            matchTeams: training || concluded ? input.previous : [],
        }
    if (parsed.data.length === 0 && training && !concluded)
        return { ok: true, matchTeams: [] }
    const frozen = matchTeamsEditability({
        kind: input.kind,
        status: input.status,
    })
    if (frozen) {
        // Re-sending the saved selection unchanged is not an edit.
        if (
            input.previous &&
            canonical(parsed.data) === canonical(input.previous)
        )
            return { ok: true, matchTeams: input.previous }
        return { ok: false, error: frozen }
    }
    if (!game.success) return { ok: false, error: "team_game_mismatch" }
    const resolved = resolveMatchTeams({
        guildId: input.guildId,
        gameId: game.data,
        inputs: parsed.data,
        previous: input.previous,
        teams: await directoryLookup(
            ctx,
            input.guildId,
            parsed.data.map((entry) => entry.teamId)
        ),
        now: input.now,
    })
    return resolved.ok
        ? { ok: true, matchTeams: resolved.assignments }
        : { ok: false, error: resolved.error }
}

/** Keeps snapshot logos alive for as long as the event references them. */
export async function syncEventAssetReferences(
    ctx: MutationCtx,
    event: Pick<Doc<"events">, "_id" | "guildId" | "matchTeams">
) {
    const assetIds: Id<"imageAssets">[] = []
    for (const assignment of event.matchTeams ?? []) {
        const id = assignment.snapshot.logoAssetId
            ? ctx.db.normalizeId("imageAssets", assignment.snapshot.logoAssetId)
            : null
        if (id && !assetIds.includes(id)) assetIds.push(id)
    }
    await syncAssetReferences(ctx, {
        guildId: event.guildId,
        owner: "event",
        ownerId: String(event._id),
        assetIds,
    })
}

/** Explicit, audited re-capture of one assignment's presentation before a match concludes. */
export const refreshSnapshot = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        eventId: v.id("events"),
        teamId: v.string(),
        actor: v.string(),
    },
    handler: async (ctx, args) => {
        if (args.secret !== INTERNAL_AUTH_SECRET)
            throw new Error("Unauthorized.")
        const guild = await getGuildById(ctx, String(args.serverId))
        if (!guild) throw new Error("Server not found.")
        const guildId = getGuildDiscordId(guild)
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== guildId)
            throw new Error("Event not found.")
        // A match past its end is frozen even before the bot records the conclusion.
        const frozen = matchTeamsEditability({
            kind: event.kind,
            status: currentEventStatus(event),
        })
        if (frozen) return { error: frozen }
        const game = teamGameSchema.safeParse(event.gameId ?? "hell_let_loose")
        if (!game.success) return { error: "team_game_mismatch" as const }
        const assignment = event.matchTeams?.find(
            (entry) => entry.teamId === args.teamId
        )
        if (!assignment) return { error: "team_not_found" as const }
        const team = (await directoryLookup(ctx, guildId, [args.teamId])).get(
            args.teamId
        )
        const now = new Date().toISOString()
        const refreshed = refreshMatchTeamSnapshot({
            guildId,
            gameId: game.data,
            assignment,
            team,
            now,
        })
        if (!refreshed.ok) return { error: refreshed.error }
        const matchTeams = event.matchTeams!.map((entry) =>
            entry.teamId === args.teamId ? refreshed.assignment : entry
        )
        await ctx.db.patch(event._id, { matchTeams, updatedAt: now })
        await syncEventAssetReferences(ctx, { ...event, matchTeams })
        const row = await teamById(ctx, guildId, args.teamId)
        if (row)
            await recordTeamAudit(ctx, row, "snapshot_refresh", args.actor, {
                eventId: String(event._id),
            })
        return { ok: true as const, matchTeams }
    },
})
