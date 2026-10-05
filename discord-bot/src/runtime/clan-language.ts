import { convex, references } from "../convex"
import { env } from "../environment"

const LANGUAGE_TTL_MS = 5 * 60_000
const languages = new Map<string, { value?: string; until: number }>()

/**
 * The clan's Discord language for messages published by background workers
 * (score panels, results, League cards), cached for a few minutes. Returns the
 * last known value, or undefined (English copy) when it cannot be read.
 */
export async function clanLanguageForGuild(
    guildId: string
): Promise<string | undefined> {
    const cached = languages.get(guildId)
    if (cached && cached.until > Date.now()) return cached.value
    try {
        const config = (await convex.query(
            references.getConfigByDiscordGuildId,
            { secret: env.internalSecret, guildId }
        )) as { defaultLanguage?: string } | null
        languages.set(guildId, {
            value: config?.defaultLanguage,
            until: Date.now() + LANGUAGE_TTL_MS,
        })
        return config?.defaultLanguage
    } catch {
        return cached?.value
    }
}
