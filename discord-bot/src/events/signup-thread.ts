import {
    ChannelType,
    ThreadAutoArchiveDuration,
    type Guild,
    type ThreadChannel,
} from "discord.js"
import { mapConcurrent } from "../runtime/work-queue"

import type { EventRecord } from "../types"
import { logWarn } from "../log"

function threadName(event: Pick<EventRecord, "name">) {
    return event.name.trim().slice(0, 100) || "Event discussion"
}

async function addMember(thread: ThreadChannel, userId: string) {
    await thread.members.add(userId).catch((error) =>
        logWarn("signup-thread", "Could not add signup to event thread", {
            threadId: thread.id,
            userId,
            error,
        })
    )
}

/** Keeps an invitation-only discussion in sync with current signups. */
export async function syncSignupThread(input: {
    guild: Guild
    event: EventRecord
    announcementMessageId?: string
    announcementChannelId?: string
    existingThreadId?: string
}) {
    if (
        !input.event.createSignupThread ||
        !input.announcementMessageId ||
        !input.announcementChannelId
    )
        return input.existingThreadId

    const channel = await input.guild.channels.fetch(
        input.announcementChannelId
    )
    if (channel?.type !== ChannelType.GuildText)
        throw new Error(
            "Private event discussions require a guild text channel"
        )

    let thread = input.existingThreadId
        ? await input.guild.channels
              .fetch(input.existingThreadId)
              .catch((error: unknown) => {
                  if (
                      typeof error === "object" &&
                      error !== null &&
                      "code" in error &&
                      error.code === 10003
                  )
                      return null
                  throw error
              })
        : null
    if (thread && thread.type !== ChannelType.PrivateThread) {
        // Discord cannot convert public threads; remove the exposed discussion.
        if (!thread.isThread())
            throw new Error("Invalid event discussion channel")
        await thread.delete(
            "Replace public event discussion with private discussion"
        )
        thread = null
    }
    if (thread && (!thread.isThread() || thread.parentId !== channel.id))
        throw new Error("Invalid event discussion parent")
    const name = threadName(input.event)
    const legacyName = `${name.slice(0, 70)} · ${input.event.id}`.slice(0, 100)
    if (!thread) {
        const active = await channel.threads.fetchActive()
        thread =
            [...active.threads.values()].find(
                (candidate) =>
                    candidate.type === ChannelType.PrivateThread &&
                    candidate.name === legacyName
            ) ??
            (await channel.threads.create({
                name,
                type: ChannelType.PrivateThread,
                invitable: false,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            }))
    }
    if (!thread.isThread()) throw new Error("Invalid event discussion")
    if (thread.archived) await thread.setArchived(false)
    if (thread.name !== name) await thread.setName(name)
    if (thread.invitable !== false) await thread.setInvitable(false)
    for (const participant of input.event.participants) {
        if (participant.status === "not_attending")
            await thread.members.remove(participant.userId)
    }

    await mapConcurrent(
        input.event.participants.filter(
            (participant) => participant.status === "attending"
        ),
        4,
        (participant) => addMember(thread, participant.userId)
    )
    return thread.id
}

/** Applies a signup button result immediately, without waiting for the next sync. */
export async function syncSignupThreadMember(input: {
    guild: Guild | null
    threadId?: string
    userId: string
    attending: boolean
}) {
    if (!input.guild || !input.threadId) return
    const thread = await input.guild.channels
        .fetch(input.threadId)
        .then((value) => (value?.isThread() ? value : null))
        .catch(() => null)
    if (!thread || thread.type !== ChannelType.PrivateThread) return
    if (thread.archived) await thread.setArchived(false)
    if (input.attending) {
        await addMember(thread, input.userId)
        return
    }
    await thread.members.remove(input.userId).catch((error) =>
        logWarn("signup-thread", "Could not remove decline from event thread", {
            threadId: thread.id,
            userId: input.userId,
            error,
        })
    )
}
