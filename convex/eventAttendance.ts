import { v } from "convex/values"

import { applyAttendanceExcuses } from "../src/domain/rosters/match-attendance"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./integrationMutation"

/**
 * Admin excuses after a match (design E3 "Omluven"): an excused player counts
 * like one with a late notice when the match closes. The Next route checks
 * the session, the clan admin right and the origin and passes the admin's
 * Discord ID; this function checks the internal secret, that the match
 * belongs to the clan, is not closed and that every player is on its roster.
 */
export const setExcuses = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        eventId: v.string(),
        actorId: v.string(),
        excuses: v.array(
            v.object({ userId: v.string(), excused: v.boolean() })
        ),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (args.excuses.length > 200) return { status: "invalid" as const }
        const eventId = ctx.db.normalizeId("events", args.eventId)
        const event = eventId ? await ctx.db.get(eventId) : null
        if (!event || event.guildId !== args.guildId)
            return { status: "not_found" as const }
        if (event.status === "concluded" || event.scoreAppliedAt)
            return { status: "closed" as const }
        const roster = await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", event._id))
            .unique()
        const onRoster = new Set([
            ...(roster?.squads ?? []).flatMap((squad) =>
                squad.players.flatMap((player) =>
                    player.id ? [player.id] : []
                )
            ),
            ...(roster?.reservePlayerIds ?? []),
        ])
        if (args.excuses.some((excuse) => !onRoster.has(excuse.userId)))
            return { status: "invalid" as const }
        const now = new Date().toISOString()
        const absenceNotices = applyAttendanceExcuses({
            notices: event.absenceNotices ?? [],
            excuses: new Map(
                args.excuses.map((excuse) => [excuse.userId, excuse.excused])
            ),
            actorId: args.actorId,
            now,
        })
        await ctx.db.patch(event._id, { absenceNotices, updatedAt: now })
        return { status: "saved" as const }
    },
})
