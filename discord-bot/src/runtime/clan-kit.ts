import type { GuildCommandConfigs } from "../commands/guild-configs"
import type { MessageKitOptions } from "../ui/message-kit"
import { guildCommandConfigs } from "../commands/runtime"
import { interactionLanguage } from "../ui/replies"

/**
 * The clan language and message style for an early reply, sent before a
 * feature has loaded its own context: "/close_ticket funguje jen ve vlákně
 * ticketu", "Tohle vlákno není ticket", the `/close_application` checks and
 * the like (M3-06). The live command settings already hold both, so this
 * reads no backend; a server they do not know gets its language only, in
 * one bounded read, and the default accent.
 */
export async function clanReplyKit(
    guildId: string | null | undefined,
    configs: Pick<GuildCommandConfigs, "peek"> = guildCommandConfigs,
    language: typeof interactionLanguage = interactionLanguage
): Promise<MessageKitOptions> {
    if (!guildId) return {}
    const config = configs.peek(guildId)
    if (config) return { language: config.language, style: config.messageStyle }
    return { language: await language(guildId) }
}

/**
 * The kit for a reply about a match whose context is gone or belongs to
 * another server, such as "Zápas už není k dispozici" behind the attendance
 * and "Zobrazit zařazení" buttons (L1-B19, L2-B01): the match's clan
 * language while it is still known, else the server the click came from,
 * else the server a DM button names in its custom ID. A DM sent before its
 * buttons named the server has none of these and reads English.
 */
export async function matchReplyKit(
    input: {
        context: { config: { defaultLanguage?: string | null } } | null
        guildId: string | null | undefined
        customIdGuildId?: string
    },
    kit: typeof clanReplyKit = clanReplyKit
): Promise<MessageKitOptions> {
    if (input.context) return { language: input.context.config.defaultLanguage }
    return kit(input.guildId || input.customIdGuildId)
}
