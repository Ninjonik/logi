import { type Guild, type ThreadChannel } from "discord.js"

import { reportToErrorsChannel } from "../ui/replies"
import { logWarn } from "../log"

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
