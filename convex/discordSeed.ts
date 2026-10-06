import { v } from "convex/values"

import {
    savePlanResultView,
    startResultView,
    stopResultView,
    type SeedActionResult,
    type SeedPlanSaveView,
} from "../src/application/discord-seed/action-result"
import {
    readSeedDashboard,
    type SeedDashboardResponse,
} from "../src/application/discord-seed/read-dashboard"
import {
    seedPorts,
    seedReadPorts,
    seedServerPanel,
    seedServers,
} from "./discordSeedStore"
import { startSeedManually } from "../src/application/discord-seed/start-seed"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { saveSeedPlan } from "../src/application/discord-seed/save-plan"
import { stopSeed } from "../src/application/discord-seed/stop-seed"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { seedPlanSettings } from "./discordSeedTable"

/**
 * The P3 page ("Seed serverů") through the authenticated web gateway: every
 * function re-checks the dashboard session and the clan-admin right in the
 * same transaction. The actor comes from the session, never from the browser.
 */

const dashboardArgs = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
const REQUEST_KEY = /^[A-Za-z0-9-]{8,64}$/

/** Members holding the role, from the synchronised member access ("@Seed · 34 členů"). */
async function roleMemberCount(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    roleId: string
) {
    const members = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    return members.filter((member) => member.roleIds.includes(roleId)).length
}

export const dashboard = query({
    args: { ...dashboardArgs, connectionId: v.optional(v.string()) },
    handler: async (ctx, args): Promise<SeedDashboardResponse> => {
        await authorizeDashboardAdmin(ctx, args)
        const servers = await seedServers(ctx, args.guildId)
        const connectionId = args.connectionId ?? servers[0]?.connectionId
        if (
            !connectionId ||
            !servers.some((server) => server.connectionId === connectionId)
        )
            return { servers, selected: null }
        const server = { guildId: args.guildId, connectionId }
        const view = await readSeedDashboard(seedReadPorts(ctx), server)
        if (!view) return { servers, selected: null }
        return {
            servers,
            selected: {
                ...view,
                panel: await seedServerPanel(ctx, server),
                roleMembers: view.settings.seedRoleId
                    ? await roleMemberCount(
                          ctx,
                          args.guildId,
                          view.settings.seedRoleId
                      )
                    : null,
            },
        }
    },
})

/** Saves one server's plan and control channel (P3-25). Channels are verified by the web route first. */
export const savePlan = mutation({
    args: {
        ...dashboardArgs,
        connectionId: v.string(),
        expectedRevision: v.union(v.number(), v.null()),
        settings: seedPlanSettings,
    },
    handler: async (ctx, args): Promise<SeedPlanSaveView> => {
        const { session } = await authorizeDashboardAdmin(ctx, args)
        return savePlanResultView(
            await saveSeedPlan(seedPorts(ctx), {
                server: {
                    guildId: args.guildId,
                    connectionId: args.connectionId,
                },
                settings: args.settings,
                expectedRevision: args.expectedRevision,
                updatedBy: session.subject,
            })
        )
    },
})

/** "Seed teď" (P3-05): a live Discord action, deliberately not part of `/api/v1`. */
export const startNow = mutation({
    args: {
        ...dashboardArgs,
        connectionId: v.string(),
        requestKey: v.string(),
    },
    handler: async (ctx, args): Promise<SeedActionResult> => {
        const { session, user } = await authorizeDashboardAdmin(ctx, args)
        if (!REQUEST_KEY.test(args.requestKey))
            throw new Error("Invalid request.")
        return startResultView(
            await startSeedManually(seedPorts(ctx), {
                server: {
                    guildId: args.guildId,
                    connectionId: args.connectionId,
                },
                actor: { id: session.subject, name: user.name },
                via: "web",
                channelId: null,
                requestKey: `web:${args.requestKey}`,
            })
        )
    },
})

/** "Ukončit seed" on the web: ends the running seed early. */
export const stopNow = mutation({
    args: { ...dashboardArgs, connectionId: v.string() },
    handler: async (ctx, args): Promise<SeedActionResult> => {
        const { session, user } = await authorizeDashboardAdmin(ctx, args)
        return stopResultView(
            await stopSeed(seedPorts(ctx), {
                server: {
                    guildId: args.guildId,
                    connectionId: args.connectionId,
                },
                actor: { id: session.subject, name: user.name },
                via: "web",
            })
        )
    },
})
