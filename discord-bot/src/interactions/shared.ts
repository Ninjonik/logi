import { type Guild, type ThreadChannel } from "discord.js"

import { getCommandMessages } from "../../../src/lib/clan-language/commands"
import type { ClanLanguage } from "../../../src/lib/clan-language/core"

import type { EventInteractionContext } from "../types"
import { reportToErrorsChannel } from "../ui/replies"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { logWarn } from "../log"

export function formatTemplate(
    template: string,
    replacements: Record<string, string>
) {
    return Object.entries(replacements).reduce(
        (message, [key, value]) => message.split(`{${key}}`).join(value),
        template
    )
}

export function getOutcomeLabel(
    language: ClanLanguage,
    outcome: "denied" | "pending" | "recruit" | "member" | "mercenary"
) {
    const messages = getCommandMessages(language)
    switch (outcome) {
        case "denied":
            return messages.commands.outcomeDenied
        case "pending":
            return messages.commands.outcomePending
        case "recruit":
            return messages.commands.outcomeRecruit
        case "member":
            return messages.commands.outcomeMember
        case "mercenary":
            return messages.commands.outcomeMercenary
    }
}

export async function loadMembershipCategoryContext(
    guildId: string,
    categoryId: string,
    gameId?: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs"
) {
    return (await convex.query(references.getMembershipCategoryContext, {
        secret: env.internalSecret,
        guildId,
        categoryId,
        gameId,
    })) as {
        config: EventInteractionContext["config"]
        category: import("../types").MembershipCategory
    } | null
}

export function resolveSupportMemberIds(
    guild: Guild,
    supportRoleIds: string[],
    includeSupportRoleMembers = true
) {
    const memberIds = new Set<string>()

    for (const member of guild.members.cache.values()) {
        const roleIds = [...member.roles.cache.keys()]
        if (
            includeSupportRoleMembers &&
            supportRoleIds.some((roleId) => roleIds.includes(roleId))
        ) {
            memberIds.add(member.id)
        }
    }

    return [...memberIds]
}

export async function cleanupThread(thread: ThreadChannel, reason: string) {
    await thread.delete(reason).catch(async (error) => {
        logWarn("interaction", "Failed to delete thread during cleanup", {
            threadId: thread.id,
            reason,
            error,
        })
        void reportToErrorsChannel({
            client: thread.client,
            guildId: thread.guildId,
            error,
            action: "Delete a thread during cleanup",
            location: "Thread cleanup",
            scope: "interaction",
            target: thread.name,
            details: {
                threadId: thread.id,
                reason,
            },
        })
        await thread.setLocked(true, reason).catch(() => null)
        await thread.setArchived(true, reason).catch(() => null)
        return null
    })
}

export async function rollbackMembershipApplicationSetup(input: {
    guild: Guild
    userId: string
    config: EventInteractionContext["config"]
    assignmentId: string
    assignmentType: "member" | "mercenary"
    assignmentStatus: "pending" | "recruit" | "active"
    membershipCategoryId: string
}) {
    const { guild, userId, assignmentId } = input
    await convex
        .mutation(references.removeAssignment, {
            secret: env.internalSecret,
            assignmentId: assignmentId as never,
            roleActor: { userId, kind: "rollback" },
            roleGuildId: guild.id,
        })
        .catch((error) => {
            logWarn(
                "interaction",
                "Failed to roll back membership assignment",
                {
                    guildId: guild.id,
                    userId,
                    assignmentId,
                    error,
                }
            )
            return null
        })

    await revalidateAppData({
        type: "assignment-changed",
        serverId: guild.id,
        userId,
        assignmentId,
    })
}
