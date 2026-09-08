import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const internalSecret =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"

export const request = mutation({
    args: {
        secret: v.string(),
        userId: v.string(),
        discordId: v.string(),
        userName: v.string(),
        type: v.union(v.literal("export"), v.literal("erasure")),
    },
    handler: async (ctx, args) => {
        if (args.secret !== internalSecret) throw new Error("Unauthorized.")
        const existing = await ctx.db
            .query("privacyRequests")
            .withIndex("userId", (q) => q.eq("userId", args.userId))
            .collect()
        const openRequest = existing.find(
            (request) =>
                request.type === args.type && request.status === "requested"
        )
        if (openRequest) return { requestId: openRequest._id, duplicate: true }
        const requestId = await ctx.db.insert("privacyRequests", {
            userId: args.userId,
            discordId: args.discordId,
            userName: args.userName,
            type: args.type,
            status: "requested",
            requestedAt: new Date().toISOString(),
        })
        return { requestId, duplicate: false }
    },
})

export const exportForUser = query({
    args: { secret: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        if (args.secret !== internalSecret) throw new Error("Unauthorized.")
        const user = (await ctx.db.query("users").collect()).find(
            (candidate) =>
                candidate.id === args.userId ||
                candidate.discordId === args.userId
        )
        if (!user) throw new Error("User not found.")
        const identifiers = new Set(
            [args.userId, user.id, user.discordId].filter(Boolean)
        )
        const includesUser = (value: string | undefined) =>
            Boolean(value && identifiers.has(value))
        const [
            assignments,
            playerStats,
            performanceHistory,
            tokens,
            requests,
            events,
            rosters,
        ] = await Promise.all([
            ctx.db
                .query("userAssignments")
                .withIndex("userId", (q) => q.eq("userId", args.userId))
                .collect(),
            ctx.db
                .query("playerStats")
                .withIndex("userId", (q) => q.eq("userId", args.userId))
                .collect(),
            ctx.db.query("playerPerformanceHistory").collect(),
            ctx.db
                .query("platformIdLinkTokens")
                .withIndex("userId", (q) => q.eq("userId", args.userId))
                .collect(),
            ctx.db
                .query("privacyRequests")
                .withIndex("userId", (q) => q.eq("userId", args.userId))
                .collect(),
            ctx.db.query("events").collect(),
            ctx.db.query("rosters").collect(),
        ])
        return {
            generatedAt: new Date().toISOString(),
            user,
            assignments,
            playerStats,
            performanceHistory: performanceHistory.filter((entry) =>
                includesUser(entry.userId)
            ),
            platformLinkTokens: tokens,
            privacyRequests: requests,
            eventParticipation: events.flatMap((event) => {
                const participants = (event.participants ?? []).filter(
                    (entry) => includesUser(entry.userId)
                )
                const signUps = (event.signUps ?? []).filter((entry) =>
                    includesUser(entry.userId)
                )
                const absenceNotices = (event.absenceNotices ?? []).filter(
                    (entry) => includesUser(entry.userId)
                )
                return participants.length ||
                    signUps.length ||
                    absenceNotices.length
                    ? [
                          {
                              eventId: event._id,
                              guildId: event.guildId,
                              eventName: event.name,
                              participants,
                              signUps,
                              absenceNotices,
                          },
                      ]
                    : []
            }),
            rosterPlacements: rosters.flatMap((roster) => {
                const squads = roster.squads
                    .map((squad) => ({
                        ...squad,
                        players: squad.players.filter((player) =>
                            includesUser(player.id)
                        ),
                    }))
                    .filter((squad) => squad.players.length)
                return squads.length ||
                    roster.reservePlayerIds.some(includesUser) ||
                    roster.notAttendingPlayerIds.some(includesUser)
                    ? [
                          {
                              rosterId: roster._id,
                              eventId: roster.eventId,
                              squads,
                              reservePlayerIds:
                                  roster.reservePlayerIds.filter(includesUser),
                              notAttendingPlayerIds:
                                  roster.notAttendingPlayerIds.filter(
                                      includesUser
                                  ),
                          },
                      ]
                    : []
            }),
        }
    },
})
