import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import type {
    SeedActionResult,
    SeedPlanSaveView,
} from "@/application/discord-seed/action-result"
import type { SeedDashboardResponse } from "@/application/discord-seed/read-dashboard"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import type { DashboardActor } from "../../../convex/dashboardActor"
import type { SeedPlanSettings } from "@/domain/discord-seed/plan"
import { getInternalAuthSecret } from "@/lib/env"

/** A clan admin's live dashboard session; the actor never comes from a request body. */
export type DiscordSeedWebAccess = { guildId: string; actor: DashboardActor }

type ActorArgs = { secret: string; guildId: string; actor: DashboardActor }

const dashboardQuery = makeFunctionReference<
    "query",
    ActorArgs & { connectionId?: string },
    SeedDashboardResponse
>("discordSeed:dashboard")
const savePlanMutation = makeFunctionReference<
    "mutation",
    ActorArgs & {
        connectionId: string
        expectedRevision: number | null
        settings: SeedPlanSettings
    },
    SeedPlanSaveView
>("discordSeed:savePlan")
const startMutation = makeFunctionReference<
    "mutation",
    ActorArgs & { connectionId: string; requestKey: string },
    SeedActionResult
>("discordSeed:startNow")
const stopMutation = makeFunctionReference<
    "mutation",
    ActorArgs & { connectionId: string },
    SeedActionResult
>("discordSeed:stopNow")

const actorArgs = (access: DiscordSeedWebAccess): ActorArgs => ({
    secret: getInternalAuthSecret(),
    guildId: access.guildId,
    actor: access.actor,
})

/** Current clan admin of the workspace, read without the dashboard cache. */
export async function discordSeedWebAccess(
    serverId: string
): Promise<DiscordSeedWebAccess | null> {
    const [server, actor] = await Promise.all([
        getServerContextUncached(serverId),
        currentDashboardActor(),
    ])
    return server?.canAdmin && actor
        ? { guildId: server.server.discordId, actor }
        : null
}

/** Tabs, plan, status and history of the P3 page; Convex re-checks the admin. */
export async function readDiscordSeed(
    access: DiscordSeedWebAccess,
    connectionId: string | null
): Promise<SeedDashboardResponse> {
    return await fetchQuery(dashboardQuery, {
        ...actorArgs(access),
        ...(connectionId ? { connectionId } : {}),
    })
}

export async function saveDiscordSeedPlan(
    access: DiscordSeedWebAccess,
    input: {
        connectionId: string
        expectedRevision: number | null
        settings: SeedPlanSettings
    }
): Promise<SeedPlanSaveView> {
    return await fetchMutation(savePlanMutation, {
        ...actorArgs(access),
        ...input,
    })
}

export async function startDiscordSeed(
    access: DiscordSeedWebAccess,
    input: { connectionId: string; requestKey: string }
): Promise<SeedActionResult> {
    return await fetchMutation(startMutation, {
        ...actorArgs(access),
        ...input,
    })
}

export async function stopDiscordSeed(
    access: DiscordSeedWebAccess,
    input: { connectionId: string }
): Promise<SeedActionResult> {
    return await fetchMutation(stopMutation, {
        ...actorArgs(access),
        ...input,
    })
}
