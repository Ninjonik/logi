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
