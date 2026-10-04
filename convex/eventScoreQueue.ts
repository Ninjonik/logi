import { ConvexEventScoreRepository } from "../src/infrastructure/convex/event-command-repositories"
import { resolveRosterScoreDelta } from "../src/domain/events/score-policy"
import { isEventCancelledBeforeMeeting } from "../src/domain/events/status"
import { internalMutation } from "./integrationMutation"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const SCORE_BATCH_SIZE = 20

/**
 * Snapshot eligible assignments before scoring. The snapshot makes retries and
 * membership changes harmless: every queued member is scored exactly once.
 */
export async function scheduleEventScore(
    ctx: MutationCtx,
    eventId: Id<"events">
) {
    const event = await ctx.db.get(eventId)
    if (!event || event.scoreResolution || event.status !== "concluded") {
        return false
    }

    if (isEventCancelledBeforeMeeting(event)) {
        await ctx.db.patch(eventId, {
            scoreResolution: "skipped",
            updatedAt: new Date().toISOString(),
        })
        return false
    }

    if (!event.scorePendingUserIds) {
        const assignments = await ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) => q.eq("serverId", event.guildId))
            .collect()
        const userIds = [
            ...new Set(
                assignments
                    .filter((assignment) => !assignment.paused)
                    .map((assignment) => assignment.userId)
            ),
        ].sort()

        if (userIds.length === 0) {
            await ctx.db.patch(eventId, {
                scoreResolution: "applied",
                scoreAppliedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            return false
        }

        await ctx.db.patch(eventId, {
            scorePendingUserIds: userIds,
            scorePendingIndex: 0,
            updatedAt: new Date().toISOString(),
        })
    }

    await ctx.scheduler.runAfter(0, internal.eventScoreJobs.run, { eventId })
    return true
}

export const processBatch = internalMutation({
    args: { eventId: v.id("events") },
    handler: async (ctx, args): Promise<{ hasMore: boolean }> => {
        const storedEvent = await ctx.db.get(args.eventId)
        if (
            !storedEvent ||
            storedEvent.scoreResolution ||
            storedEvent.status !== "concluded"
        ) {
            return { hasMore: false }
        }

        const userIds = storedEvent.scorePendingUserIds ?? []
        const start = storedEvent.scorePendingIndex ?? 0
        const batchUserIds = userIds.slice(start, start + SCORE_BATCH_SIZE)
        const repository = new ConvexEventScoreRepository(
            ctx,
            DEFAULT_ROSTER_SCORE_SETTINGS
        )
        const event = await repository.getEvent(String(args.eventId))

        if (!event || isEventCancelledBeforeMeeting(event)) {
            await repository.markEventScoreSkipped(String(args.eventId))
            return { hasMore: false }
        }

        if (batchUserIds.length > 0) {
            const [settings, roster, users] = await Promise.all([
                repository.getScoreSettings(event.guildId),
                repository.getRoster(String(args.eventId)),
                repository.getUsers(batchUserIds),
            ])

            for (const user of users) {
                const delta = resolveRosterScoreDelta({
                    userId: user.userId,
                    settings,
                    participants: event.participants,
                    notices: event.absenceNotices,
                    roster,
                })
                const scores = {
                    ...(user.scores ?? {}),
                    [event.guildId]:
                        (user.scores?.[event.guildId] ?? user.score ?? 0) +
                        delta,
                }
                await repository.updateUserScore(user.userId, {
                    score: scores[event.guildId],
                    scores,
                })
            }
        }

        const nextIndex = start + batchUserIds.length
        if (nextIndex < userIds.length) {
            await ctx.db.patch(args.eventId, {
                scorePendingIndex: nextIndex,
                updatedAt: new Date().toISOString(),
            })
            // Scheduling this continuation in the same transaction makes a
            // committed batch recoverable even if its caller exits afterward.
            await ctx.scheduler.runAfter(0, internal.eventScoreJobs.run, {
                eventId: args.eventId,
            })
            return { hasMore: true }
        }

        await ctx.db.patch(args.eventId, {
            scoreAppliedAt: new Date().toISOString(),
            scoreResolution: "applied",
            scorePendingUserIds: undefined,
            scorePendingIndex: undefined,
            updatedAt: new Date().toISOString(),
        })
        return { hasMore: false }
    },
})
