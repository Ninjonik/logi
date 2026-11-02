import {
    reconcileResultAttendance,
    type AttendanceEvidence,
} from "../../domain/rosters/result-attendance"
import type { ResultRevision } from "../../domain/match-results/result-revision"
import { getUserByDiscordId, getUserStableId } from "../../../convex/identity"
import { providerSessionSchema } from "../../domain/game-data/contracts"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Doc } from "../../../convex/_generated/dataModel"
import { resolveGameScope } from "../../domain/games/game"

export async function applyResultAttendance(
    ctx: MutationCtx,
    event: Doc<"events">,
    revision: ResultRevision
) {
    if (revision.status === "provisional") return
    const evidence: AttendanceEvidence[] = revision.players.map((player) => ({
        key: `${player.platform}:${player.platformId}`,
        logiUserId: player.logiUserId,
        name: null,
    }))
    for (const link of revision.sessionLinks) {
        const id = ctx.db.normalizeId("gameSessions", link.sessionId)
        const row = id ? await ctx.db.get(id) : null
        if (
            !row ||
            row.guildId !== event.guildId ||
            row.gameId !== resolveGameScope(event.gameId)
        )
            throw new Error("Session outside event scope.")
        const session = providerSessionSchema.parse(row.session)
        if (!session.complete || session.sourceDigest !== link.sourceDigest)
            throw new Error("Result source changed.")
        for (const player of session.players) {
            const key = `${player.platform}:${player.platformId}`
            evidence.push({
                key,
                logiUserId:
                    revision.players.find(
                        (p) => `${p.platform}:${p.platformId}` === key
                    )?.logiUserId ?? null,
                name: player.name,
            })
        }
    }
    await applyAttendanceEvidence(ctx, event, evidence, revision.createdAt)
}

export async function applyAttendanceEvidence(
    ctx: MutationCtx,
    event: Doc<"events">,
    evidence: AttendanceEvidence[],
    now: string
) {
    if (
        (event.kind ?? "match") !== "match" ||
        event.status === "concluded" ||
        event.scoreAppliedAt
    )
        return
    const roster = await ctx.db
        .query("rosters")
        .withIndex("eventId", (q) => q.eq("eventId", event._id))
        .unique()
    if (
        !roster ||
        (roster.guildId && roster.guildId !== event.guildId) ||
        resolveGameScope(roster.gameId) !== resolveGameScope(event.gameId)
    )
        return
    const ids = [
        ...new Set([
            ...roster.squads.flatMap((s) =>
                s.players.flatMap((p) => (p.id ? [p.id] : []))
            ),
            ...roster.reservePlayerIds,
        ]),
    ]
    const identities = (
        await Promise.all(
            ids.map(async (userId) => {
                const user = await getUserByDiscordId(ctx, userId)
                return user
                    ? {
                          userId,
                          logiUserId: getUserStableId(user),
                          names: [
                              user.name,
                              user.nicknames?.[event.guildId],
                              user.steamName,
                          ].filter((name): name is string => Boolean(name)),
                      }
                    : null
            })
        )
    ).filter((identity) => identity !== null)
    const next = reconcileResultAttendance(roster, identities, evidence)
    if (next !== roster)
        await ctx.db.patch(roster._id, {
            squads: next.squads,
            reserveAttendances: next.reserveAttendances,
            updatedAt: now,
        })
}
