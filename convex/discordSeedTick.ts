import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import { planFromDoc, seedPorts, seedStoreReader } from "./discordSeedStore"
import { evaluateSeedPlan } from "../src/application/discord-seed/tick"
import { internalMutation } from "./_generated/server"

/**
 * The seed tick runs in Convex, not in the bot: plans, runs and the collected
 * player counts all live here, so each decision (start, live, timeout, fail)
 * is one transaction that a duplicate cron delivery or a second bot instance
 * cannot repeat. Seeds also end on time while the bot is offline. The bot only
 * delivers the Discord messages the tick asks for.
 */
const evaluatePlanReference = makeFunctionReference<
    "mutation",
    { planId: string }
>("discordSeedTick:evaluatePlan")

/** Cron entry: fans out one transaction per plan that is on or still seeding. */
export const evaluate = internalMutation({
    args: {},
    handler: async (ctx) => {
        const plans = await seedStoreReader(ctx).plansToEvaluate()
        for (const plan of plans)
            await ctx.scheduler.runAfter(0, evaluatePlanReference, {
                planId: plan.id,
            })
        return plans.length
    },
})

/** One plan's tick; safe to run twice for the same minute. */
export const evaluatePlan = internalMutation({
    args: { planId: v.string() },
    handler: async (ctx, args) => {
        const id = ctx.db.normalizeId("discordSeedPlans", args.planId)
        const doc = id ? await ctx.db.get(id) : null
        if (!doc) return { kind: "idle" as const }
        const plan = planFromDoc(doc)
        if (!plan.settings.enabled && !plan.state.activeRunId)
            return { kind: "idle" as const }
        return await evaluateSeedPlan(seedPorts(ctx), plan, Date.now())
    },
})
