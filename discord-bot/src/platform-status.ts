import type {
    Client,
    MessageCreateOptions,
    MessageEditOptions,
} from "discord.js"

import {
    nextServiceStates,
    serviceChangeView,
    serviceStatusView,
    SERVICE_STATUS_INTERVAL_SECONDS,
    type ServiceState,
} from "../../src/domain/discord-messages/service-status"
import { getSystemMessages } from "../../src/lib/clan-language/system"
import { clanLanguageForGuild } from "./runtime/clan-language"
import { editPayload, messagePayload } from "./ui/message-kit"
import { convex, references } from "./convex"
import { logError, logInfo } from "./log"
import { env } from "./environment"

type Service = { name: string; group_id: number; online: boolean }
type Settings = {
    workspaceGuildId: string
    statusChannelId?: string
    statusMessageId?: string
    statusUpdatesThreadId?: string
    serviceStates?: ServiceState[]
}

/** The Logi services group of the status API; game servers are not in it (L5-B07). */
const LOGI_SERVICES_GROUP = 2

async function getServices() {
    try {
        const response = await fetch(env.statusApiUrl)
        if (!response.ok) return null
        const services = (await response.json()) as Service[]
        const logiServices = services.filter(
            (service) => service.group_id === LOGI_SERVICES_GROUP
        )
        return logiServices.length
            ? logiServices.map(({ name, online }) => ({ name, online }))
            : null
    } catch {
        return null
    }
}

type StatusMessage = { edit(options: MessageEditOptions): Promise<unknown> }
type StatusThread = {
    name: string
    setName(name: string): Promise<unknown>
    send(options: MessageCreateOptions): Promise<unknown>
}

/** What one status pass reads and writes; Discord and Convex in production. */
export type PlatformStatusPorts = {
    settings(): Promise<Settings | null>
    /** The Logi services, or null when the monitor does not answer. */
    services(): Promise<Array<{ name: string; online: boolean }> | null>
    language(workspaceGuildId: string): Promise<string | undefined>
    /** The stored status message, or null when it is gone. */
    statusMessage(
        channelId: string,
        messageId: string | undefined
    ): Promise<StatusMessage | null>
    /** Posts a new status message with its "Změny stavu" thread. */
    createStatusMessage(
        channelId: string,
        message: MessageCreateOptions,
        threadName: string
    ): Promise<{ messageId: string; threadId: string } | null>
    thread(threadId: string): Promise<StatusThread | null>
    save(state: {
        statusMessageId?: string
        statusUpdatesThreadId?: string
        serviceStates: ServiceState[]
    }): Promise<unknown>
    now(): number
}

/**
 * One check (board L5 1.2): the status message in the clan language of the
 * Logi workspace, edited in place, and one grey card per changed service in
 * the thread "Změny stavu"; a recovery says how long the outage lasted. A
 * silent monitor keeps the stored states, so the outage time survives it.
 */
export async function runPlatformStatusPass(ports: PlatformStatusPorts) {
    const settings = await ports.settings()
    if (!settings?.statusChannelId) return null
    const language = await ports.language(settings.workspaceGuildId)
    const copy = getSystemMessages(language)
    const options = { language }
    const services = await ports.services()
    const now = ports.now()
    const view = serviceStatusView({
        copy: copy.serviceStatus,
        locale: copy.locale,
        services,
        checkedAt: now,
    })
    let statusMessageId = settings.statusMessageId
    let statusUpdatesThreadId = settings.statusUpdatesThreadId
    const message = await ports.statusMessage(
        settings.statusChannelId,
        statusMessageId
    )
    if (message) await message.edit(editPayload(view, options))
    else {
        const created = await ports.createStatusMessage(
            settings.statusChannelId,
            messagePayload(view, options),
            copy.serviceStatus.threadName
        )
        if (!created) return null
        statusMessageId = created.messageId
        statusUpdatesThreadId = created.threadId
    }

    const { states, changes } = services
        ? nextServiceStates(
              settings.serviceStates,
              services,
              new Date(now).toISOString()
          )
        : { states: settings.serviceStates ?? [], changes: [] }
    const thread = statusUpdatesThreadId
        ? await ports.thread(statusUpdatesThreadId)
        : null
    // Threads created before the redesign were named "Status updates".
    if (thread && thread.name !== copy.serviceStatus.threadName)
        await thread.setName(copy.serviceStatus.threadName).catch(() => null)
    if (thread)
        for (const change of changes)
            await thread.send(
                messagePayload(
                    serviceChangeView({
                        copy: copy.serviceStatus,
                        locale: copy.locale,
                        change,
                    }),
                    options
                )
            )
    await ports.save({
        statusMessageId,
        statusUpdatesThreadId,
        serviceStates: states,
    })
    return { states, changes }
}

function discordPorts(client: Client): PlatformStatusPorts {
    const textChannel = async (channelId: string) => {
        const channel = await client.channels.fetch(channelId).catch(() => null)
        return channel?.isTextBased() &&
            "messages" in channel &&
            "send" in channel
            ? channel
            : null
    }
    return {
        settings: async () =>
            (await convex.query(references.getPlatformSettings, {
                secret: env.internalSecret,
            })) as Settings | null,
        services: getServices,
        language: clanLanguageForGuild,
        statusMessage: async (channelId, messageId) => {
            if (!messageId) return null
            const channel = await textChannel(channelId)
            return channel
                ? await channel.messages.fetch(messageId).catch(() => null)
                : null
        },
        createStatusMessage: async (channelId, message, threadName) => {
            const channel = await textChannel(channelId)
            if (!channel) return null
            const created = await channel.send(message)
            const thread = await created.startThread({
                name: threadName,
                autoArchiveDuration: 10080,
            })
            return { messageId: created.id, threadId: thread.id }
        },
        thread: async (threadId) => {
            const thread = await client.channels
                .fetch(threadId)
                .catch(() => null)
            return thread?.isThread() ? thread : null
        },
        save: (state) =>
            convex.mutation(references.updatePlatformStatusState, {
                secret: env.internalSecret,
                ...state,
            }),
        now: Date.now,
    }
}

export async function syncPlatformStatus(client: Client) {
    const result = await runPlatformStatusPass(discordPorts(client))
    if (result)
        logInfo("platform-status", "Synced platform status", {
            serviceCount: result.states.length,
            changes: result.changes.length,
        })
}

/** Checks the Logi services every 30 s (L5-B06). */
export function startPlatformStatusMonitor(client: Client) {
    const run = () =>
        syncPlatformStatus(client).catch((error) =>
            logError("platform-status", "Failed to sync platform status", {
                error,
            })
        )
    run()
    return setInterval(run, SERVICE_STATUS_INTERVAL_SECONDS * 1000)
}
