import { mutation, type MutationCtx } from "./_generated/server"
import { ownedDelivery, deliveryOwner } from "./discordDelivery"
import { claimSignupRunForEvent } from "./eventReminders"
import { assertInternalSecret } from "./discord_shared"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

export async function enqueueScheduledDispatch(
    ctx: MutationCtx,
    job: Doc<"eventScheduleJobs">,
    changedEventIds: string[],
    scoreEventIds: string[]
) {
    const event = await ctx.db.get(job.eventId)
    if (!event || event.isDraft || event.sharedAccessRevoked) return
    await ctx.db.insert("discordScheduledDispatches", {
        eventId: job.eventId,
        guildId: event.guildId,
        kind: job.kind,
        dueAt: job.dueAt,
        changedEventIds: [
            ...new Set([String(job.eventId), ...changedEventIds]),
        ],
        scoreEventIds: [...new Set(scoreEventIds)],
        status: "pending",
        retryAt: 0,
        attempts: 0,
        createdAt: Date.now(),
    })
}

export const claim = mutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        const expired = await ctx.db
            .query("discordScheduledDispatches")
            .withIndex("status_leaseUntil", (q) =>
                q.eq("status", "processing").lte("leaseUntil", now)
            )
            .take(25)
        for (const row of expired)
            await ctx.db.patch(row._id, {
                status: "pending",
                retryAt: now,
                claimToken: undefined,
                leaseUntil: undefined,
            })
        const row = await ctx.db
            .query("discordScheduledDispatches")
            .withIndex("status_retryAt", (q) =>
                q.eq("status", "pending").lte("retryAt", now)
            )
            .first()
        if (!row) return null
        const event = await ctx.db.get(row.eventId)
        if (
            !event ||
            event.guildId !== row.guildId ||
            event.isDraft ||
            event.sharedAccessRevoked
        ) {
            await ctx.db.delete(row._id)
            return null
        }
        const claimToken = `${row._id}:${row.attempts + 1}:${now}`
        await ctx.db.patch(row._id, {
            status: "processing",
            attempts: row.attempts + 1,
            claimToken,
            leaseUntil: now + 5 * 60_000,
        })
        return { ...row, id: String(row._id), claimToken }
    },
})

export const acknowledge = mutation({
    args: { secret: v.string(), owner: deliveryOwner },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (args.owner.kind !== "dispatch")
            throw new Error("Invalid dispatch owner")
        const row = await ownedDelivery(ctx, args.owner)
        await ctx.db.delete(row._id)
    },
})
export const retry = mutation({
    args: { secret: v.string(), owner: deliveryOwner },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (args.owner.kind !== "dispatch")
            throw new Error("Invalid dispatch owner")
        const row = await ownedDelivery(ctx, args.owner)
        await ctx.db.patch(row._id, {
            status: "pending",
            retryAt: Date.now() + 60_000,
            leaseUntil: undefined,
            claimToken: undefined,
        })
    },
})
export const reserveSignup = mutation({
    args: { secret: v.string(), owner: deliveryOwner },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (args.owner.kind !== "dispatch")
            throw new Error("Invalid dispatch owner")
        await ownedDelivery(ctx, args.owner)
        const id = ctx.db.normalizeId(
            "discordScheduledDispatches",
            args.owner.id
        )
        const row = id ? await ctx.db.get(id) : null
        if (!row || row.kind !== "signup-reminder") return false
        if (row.signupReserved)
            return claimSignupRunForEvent(
                ctx,
                { guildId: row.guildId, eventId: String(row.eventId) },
                true
            )
        if (
            !(await claimSignupRunForEvent(ctx, {
                guildId: row.guildId,
                eventId: String(row.eventId),
            }))
        )
            return false
        await ctx.db.patch(row._id, { signupReserved: true })
        return true
    },
})
