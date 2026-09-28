import { EmbedBuilder, type Client, type TextChannel } from "discord.js"

import { convex, references } from "./convex"
import { logError, logInfo } from "./log"
import { env } from "./environment"

type Service = { name: string; group_id: number; online: boolean }
type Settings = {
    workspaceGuildId: string
    statusChannelId?: string
    statusMessageId?: string
    statusUpdatesThreadId?: string
    serviceStates?: Array<{ name: string; online: boolean }>
}

async function getServices() {
    try {
        const response = await fetch(env.statusApiUrl)
        if (!response.ok) return null
        const services = (await response.json()) as Service[]
        const logiServices = services.filter(
            (service) => service.group_id === 2
        )
        return logiServices.length ? logiServices : null
    } catch {
        return null
    }
}

function statusEmbed(services: Service[] | null) {
    const unknown = !services
    const degraded = services?.some((service) => !service.online)
    return new EmbedBuilder()
        .setTitle("Logi service status")
        .setColor(unknown ? 0x6b7280 : degraded ? 0xf59e0b : 0x22c55e)
        .setDescription(
            unknown
                ? "Status monitoring is currently unavailable."
                : degraded
                  ? "One or more Logi services are degraded."
                  : "All monitored Logi services are operational."
        )
        .addFields(
            ...(services ?? []).map((service) => ({
                name: service.name,
                value: service.online ? "Operational" : "Degraded",
                inline: true,
            }))
        )
        .setTimestamp()
}

export async function syncPlatformStatus(client: Client) {
    const settings = (await convex.query(references.getPlatformSettings, {
        secret: env.internalSecret,
    })) as Settings | null
    if (!settings?.statusChannelId) return

    const channel = await client.channels
        .fetch(settings.statusChannelId)
        .catch(() => null)
    if (!channel?.isTextBased() || !("messages" in channel)) return
    const textChannel = channel as TextChannel
    const services = await getServices()
    const states = (services ?? []).map(({ name, online }) => ({
        name,
        online,
    }))
    let statusMessageId = settings.statusMessageId
    let statusUpdatesThreadId = settings.statusUpdatesThreadId
    const embed = statusEmbed(services)

    const message = statusMessageId
        ? await textChannel.messages.fetch(statusMessageId).catch(() => null)
        : null
    if (message) {
        await message.edit({ embeds: [embed] })
    } else {
        const created = await textChannel.send({ embeds: [embed] })
        statusMessageId = created.id
        const thread = await created.startThread({
            name: "Status updates",
            autoArchiveDuration: 10080,
        })
        statusUpdatesThreadId = thread.id
    }

    const previous = new Map(
        (settings.serviceStates ?? []).map((item) => [item.name, item.online])
    )
    const changes = states.filter(
        (item) =>
            previous.has(item.name) && previous.get(item.name) !== item.online
    )
    if (changes.length && statusUpdatesThreadId) {
        const thread = await client.channels
            .fetch(statusUpdatesThreadId)
            .catch(() => null)
        if (thread?.isTextBased() && "send" in thread) {
            await thread.send({
                content: changes
                    .map(
                        (item) =>
                            `${item.online ? "🟢" : "🔴"} **${item.name}** is now ${item.online ? "operational" : "degraded"}.`
                    )
                    .join("\n"),
            })
        }
    }
    await convex.mutation(references.updatePlatformStatusState, {
        secret: env.internalSecret,
        statusMessageId,
        statusUpdatesThreadId,
        serviceStates: states,
    })
    logInfo("platform-status", "Synced platform status", {
        serviceCount: states.length,
    })
}

export function startPlatformStatusMonitor(client: Client) {
    const run = () =>
        syncPlatformStatus(client).catch((error) =>
            logError("platform-status", "Failed to sync platform status", {
                error,
            })
        )
    run()
    return setInterval(run, 30_000)
}
