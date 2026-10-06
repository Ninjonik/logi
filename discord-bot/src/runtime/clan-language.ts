import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import { convex, references } from "../convex"
import { env } from "../environment"

const LANGUAGE_TTL_MS = 5 * 60_000
const languages = new Map<
    string,
    { value?: string; style: MessageStyle | null; until: number }
>()

/** The last known language without a backend read, for time-critical replies. */
export function cachedClanLanguage(guildId: string | null | undefined) {
    return guildId ? languages.get(guildId)?.value : undefined
}

async function readClanConfig(guildId: string) {
    const cached = languages.get(guildId)
    if (cached && cached.until > Date.now()) return cached
    try {
        const config = (await convex.query(
            references.getConfigByDiscordGuildId,
            { secret: env.internalSecret, guildId }
        )) as {
            defaultLanguage?: string
            messageStyle?: MessageStyle | null
        } | null
        const entry = {
            value: config?.defaultLanguage,
            style: config?.messageStyle ?? null,
            until: Date.now() + LANGUAGE_TTL_MS,
        }
        languages.set(guildId, entry)
        return entry
    } catch {
        return cached ?? null
    }
}

/**
 * The clan's Discord language for messages published by background workers
 * (score panels, results, League cards), cached for a few minutes. Returns the
 * last known value, or undefined (English copy) when it cannot be read.
 */
export async function clanLanguageForGuild(
    guildId: string
): Promise<string | undefined> {
    return (await readClanConfig(guildId))?.value
}

/**
 * The clan's message style (its colour and icon density) for private replies,
 * read with the language and cached the same way (L3-39, L3-58). Null keeps
 * the default orange when it cannot be read.
 */
export async function clanStyleForGuild(
    guildId: string | null | undefined
): Promise<MessageStyle | null> {
    if (!guildId) return null
    return (await readClanConfig(guildId))?.style ?? null
}
