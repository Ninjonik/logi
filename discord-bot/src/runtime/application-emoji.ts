import { makeFunctionReference } from "convex/server"
import type { Client } from "discord.js"

import {
    emojiMarkup,
    provisionApplicationEmoji,
    type EmojiProvisioningReport,
} from "../../../src/application/discord-publications/provision-emoji"
import {
    applicationEmojiAssets,
    type PanelEmojiAsset,
} from "../public-panels/assets"
import type { PanelEmojiKey } from "../../../src/domain/discord-publications/panel-emblems"

const RECHECK_MS = 60 * 60 * 1000
const RETRY_MS = 5 * 60 * 1000

export type PanelEmojiMarkup = Partial<Record<PanelEmojiKey, string>>
export type ApplicationEmojiPorts = {
    assets(): Promise<PanelEmojiAsset[]>
    list(): Promise<{ id: string; name: string | null }[]>
    create(asset: PanelEmojiAsset): Promise<{ id: string; name: string | null }>
    /** Stores what is installed so "Grafika panelů" can show it (P8-20, P8-24). */
    report(report: {
        applicationId: string
        ready: string[]
        failed: string[]
        checkedAt: number
        /** Public IDs and names, so dashboard previews show the signs (P2-B09). */
        installed: Array<{ key: string; id: string; name: string }>
    }): Promise<void>
    applicationId(): string | null
    now(): number
}

/**
 * Keeps the fixed panel signs installed as application emoji (P7-B03,
 * P7-24): on start and then hourly it lists the application's emoji and
 * uploads only what is missing, so restarts upload nothing and the emoji work
 * in every channel without the external-emoji permission. Failures are
 * retried later; panels meanwhile fall back to plain markers.
 */
export function createApplicationEmojiService(ports: ApplicationEmojiPorts) {
    let current: PanelEmojiMarkup = {}
    /** When the next check is due; the first call always provisions. */
    let dueAt = Number.NEGATIVE_INFINITY
    let running: Promise<PanelEmojiMarkup> | null = null
    async function provision(): Promise<PanelEmojiMarkup> {
        const assets = await ports.assets()
        const result: EmojiProvisioningReport<PanelEmojiKey> =
            await provisionApplicationEmoji(assets, {
                list: ports.list,
                create: ports.create,
            })
        const markup: PanelEmojiMarkup = {}
        for (const [key, emoji] of Object.entries(result.emoji))
            if (emoji) markup[key as PanelEmojiKey] = emojiMarkup(emoji)
        current = markup
        const checkedAt = ports.now()
        // A sign that failed to upload is retried in minutes, not an hour.
        dueAt = checkedAt + (result.failed.length ? RETRY_MS : RECHECK_MS)
        const applicationId = ports.applicationId()
        if (applicationId)
            await ports
                .report({
                    applicationId,
                    ready: Object.keys(markup),
                    failed: result.failed,
                    checkedAt,
                    installed: Object.entries(result.emoji).flatMap(
                        ([key, emoji]) =>
                            emoji
                                ? [{ key, id: emoji.id, name: emoji.name }]
                                : []
                    ),
                })
                .catch(() => undefined)
        return markup
    }
    return {
        /** Installed sign markup by key; provisions when stale. Never throws. */
        async emoji(): Promise<PanelEmojiMarkup> {
            if (ports.now() < dueAt) return current
            running ??= provision()
                .catch(() => {
                    // Try again in a few minutes rather than on every call.
                    dueAt = ports.now() + RETRY_MS
                    return current
                })
                .finally(() => {
                    running = null
                })
            return running
        },
        /** Last known markup without waiting. */
        cached(): PanelEmojiMarkup {
            return current
        },
    }
}

let service: ReturnType<typeof createApplicationEmojiService> | null = null
/** The process-wide service for this Discord client. */
export function applicationEmoji(client: Client) {
    service ??= createApplicationEmojiService({
        assets: applicationEmojiAssets,
        list: async () => {
            const emojis = await client.application!.emojis.fetch()
            return [...emojis.values()].map((e) => ({ id: e.id, name: e.name }))
        },
        create: async (asset) => {
            const emoji = await client.application!.emojis.create({
                attachment: asset.image,
                name: asset.name,
            })
            return { id: emoji.id, name: emoji.name }
        },
        report: async (report) => {
            const [{ convex }, { env }] = await Promise.all([
                import("../convex"),
                import("../environment"),
            ])
            await convex.mutation(
                makeFunctionReference<"mutation">(
                    "discordPanelGraphicsWrites:reportEmoji"
                ),
                { secret: env.internalSecret, report }
            )
        },
        applicationId: () => client.application?.id ?? null,
        now: Date.now,
    })
    return service
}

/** Provisions on start and re-checks hourly; never blocks or fails the bot. */
export function startApplicationEmojiProvisioning(client: Client) {
    // Cheap while fresh: the service itself decides when an hour has passed.
    const tick = () => void applicationEmoji(client).emoji()
    tick()
    setInterval(tick, RETRY_MS).unref?.()
}
