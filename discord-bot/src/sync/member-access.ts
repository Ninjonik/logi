import {
    GuildMembershipIngress,
    MembershipReconciliationSchedule,
    reconcileMembershipSnapshot,
    type FetchedMember,
} from "./membership-ingress"
import { makeFunctionReference } from "convex/server"
import type { Client, GuildMember } from "discord.js"

import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import type { SyncPayload } from "../types"
import { logInfo, logWarn } from "../log"
import { env } from "../environment"

const ingress = new GuildMembershipIngress()
const epochs = new Map<string, string>()
const schedule = new MembershipReconciliationSchedule()
const memberReference = (name: string) =>
    makeFunctionReference<"mutation">(`memberObservations:${name}`)
const reconciliationStart = makeFunctionReference<"query">(
    "memberObservations:reconciliationStart"
)
async function memberEpoch(guildId: string) {
    let epoch = epochs.get(guildId)
    if (!epoch) {
        epoch = (await convex.mutation(memberReference("ensureGuild"), {
            secret: env.internalSecret,
            guildId,
        })) as string
        epochs.set(guildId, epoch)
    }
    return epoch
}
export async function invalidateMembershipGuild(guildId: string) {
    return ingress.run(guildId, async () => {
        epochs.delete(guildId)
        schedule.invalidate(guildId)
        const epoch = (await convex.mutation(
            memberReference("invalidateGuild"),
            { secret: env.internalSecret, guildId }
        )) as string
        epochs.set(guildId, epoch)
    })
}

/** Keeps explicit Logi admin assignments reflected in Discord's configured role. */
export async function syncDashboardAdminRoles(
    client: Client,
    payload: SyncPayload
) {
    const roleId = payload.config.dashboardAdminRoleId
    if (!roleId) return

    const guild = await client.guilds
        .fetch(payload.config.guildId)
        .catch(() => null)
    if (!guild) return

    const role = await guild.roles.fetch(roleId).catch(() => null)
    if (!role) {
        logWarn("member-access", "Dashboard admin role could not be fetched", {
            guildId: guild.id,
            roleId,
        })
        return
    }

    const overrides = payload.guild.adminAccessOverrides ?? {}
    await Promise.all(
        Object.entries(overrides).map(async ([userId, isAdmin]) => {
            const member = await guild.members.fetch(userId).catch(() => null)
            if (!member || member.roles.cache.has(roleId) === isAdmin) return

            await (
                isAdmin
                    ? member.roles.add(
                          role,
                          "Synced from Logi dashboard admin access"
                      )
                    : member.roles.remove(
                          role,
                          "Synced from Logi dashboard admin access"
                      )
            ).catch((error) => {
                logWarn(
                    "member-access",
                    "Failed to sync dashboard admin role",
                    {
                        guildId: guild.id,
                        userId,
                        roleId,
                        isAdmin,
                        error,
                    }
                )
            })
        })
    )
}

/**
 * A newer epoch refused the run: the backend says so, or this process
 * invalidated the guild while the run was writing (a redacted error message
 * still carries the second signal).
 */
function isSuperseded(
    guildId: string,
    snapshotEpoch: string | undefined,
    error: unknown
) {
    const current = epochs.get(guildId)
    return (
        (error instanceof Error &&
            /Reconciliation superseded/.test(error.message)) ||
        (snapshotEpoch !== undefined &&
            current !== undefined &&
            current !== snapshotEpoch)
    )
}

async function fetchCompleteMembers(
    client: Client,
    payload: SyncPayload
): Promise<FetchedMember[] | null> {
    const guildId = payload.config.guildId
    try {
        const guild = await client.guilds.fetch(guildId).catch(() => null)
        if (!guild?.available) return null
        const members = await guild.members
            .fetch({ time: 10_000 })
            .catch(() => null)
        if (
            !members ||
            !guild.available ||
            members.size !== guild.memberCount ||
            !client.user ||
            !members.has(client.user.id) ||
            members.some((member) => member.partial)
        ) {
            logWarn(
                "member-access",
                "Full membership fetch unavailable or incomplete",
                { guildId }
            )
            return null
        }
        return [...members.values()].map((member) => {
            const roleIds = [...member.roles.cache.keys()].filter(
                (roleId) => roleId !== guildId
            )
            const isAdmin = member.permissions.has("Administrator")
            return {
                discordUserId: member.id,
                roleIds,
                isAdmin,
                hasDashboardAccess:
                    isAdmin ||
                    Boolean(
                        payload.config.dashboardAdminRoleId &&
                        roleIds.includes(payload.config.dashboardAdminRoleId)
                    ),
            }
        })
    } catch (error) {
        logWarn("member-access", "Full membership fetch failed", {
            guildId,
            error,
        })
        return null
    }
}

/**
 * Full reconciliation of one guild's members, on the cadence of
 * `MembershipReconciliationSchedule`: the start is read before the Discord
 * fetch and the run is inserted only after a complete fetch.
 */
export async function syncGuildMemberAccess(
    client: Client,
    payload: SyncPayload
) {
    const guildId = payload.config.guildId,
        dashboardRoleId = payload.config.dashboardAdminRoleId ?? ""
    if (!schedule.due(guildId, dashboardRoleId)) return
    let snapshotEpoch: string | undefined
    const outcome = await reconcileMembershipSnapshot({
        start: () =>
            ingress.run(guildId, async () => {
                const observedAt = new Date().toISOString()
                snapshotEpoch = await memberEpoch(guildId)
                const start = (await convex.query(reconciliationStart, {
                    secret: env.internalSecret,
                    guildId,
                })) as { epoch: string; revision: string } | null
                return start?.epoch === snapshotEpoch
                    ? { ...start, observedAt }
                    : null
            }),
        fetchComplete: () => fetchCompleteMembers(client, payload),
        begin: (start) =>
            ingress.run(guildId, () =>
                convex.mutation(memberReference("beginReconciliation"), {
                    secret: env.internalSecret,
                    guildId,
                    epoch: start.epoch,
                    startedRevision: start.revision,
                    observedAt: start.observedAt,
                })
            ),
        batch: (runId, batch, expectedCount, members) =>
            ingress.run(guildId, () =>
                convex.mutation(memberReference("applyReconciliationBatch"), {
                    secret: env.internalSecret,
                    runId: runId as never,
                    batch,
                    expectedCount,
                    members,
                })
            ),
        finish: (runId) =>
            ingress.run(guildId, () =>
                convex.mutation(memberReference("finishReconciliation"), {
                    secret: env.internalSecret,
                    runId: runId as never,
                })
            ),
        superseded: (error) => isSuperseded(guildId, snapshotEpoch, error),
    })
    if (outcome === "incomplete") {
        schedule.fetchFailed(guildId)
        return
    }
    if (outcome === "superseded") {
        // The invalidation that replaced the run asked for a new one.
        logInfo(
            "member-access",
            "Membership reconciliation superseded by a newer epoch",
            { guildId }
        )
        return
    }
    await ingress.run(guildId, async () => {
        if (epochs.get(guildId) === snapshotEpoch)
            schedule.complete(guildId, dashboardRoleId)
    })
    logInfo("member-access", "Completed fenced membership reconciliation", {
        guildId,
    })
    await revalidateAppData({
        type: "server-context-changed",
        serverId: guildId,
    })
}
export async function syncGuildMemberAccessMember(
    member: GuildMember,
    dashboardAdminRoleId?: string
) {
    const roleIds = [...member.roles.cache.keys()].filter(
        (roleId) => roleId !== member.guild.id
    )
    const observedAt = new Date().toISOString()
    const isAdmin = member.permissions.has("Administrator")
    const hasDashboardAccess =
        isAdmin ||
        Boolean(dashboardAdminRoleId && roleIds.includes(dashboardAdminRoleId))
    return ingress.run(member.guild.id, async () =>
        convex.mutation(references.upsertMemberAccess, {
            secret: env.internalSecret,
            guildId: member.guild.id,
            userId: member.id,
            roleIds,
            isAdmin,
            hasDashboardAccess,
            observation: {
                epoch: await memberEpoch(member.guild.id),
                observedAt,
            },
        })
    )
}

export async function removeGuildMemberAccess(guildId: string, userId: string) {
    const observedAt = new Date().toISOString()
    return ingress.run(guildId, async () =>
        convex.mutation(references.removeMemberAccess, {
            secret: env.internalSecret,
            guildId,
            userId,
            observation: { epoch: await memberEpoch(guildId), observedAt },
        })
    )
}
