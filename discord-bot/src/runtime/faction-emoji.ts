import type { Client } from "discord.js"

import type { PanelFactionEmoji } from "../../../src/domain/discord-publications/panel-presentation"
import { applicationEmoji, type PanelEmojiMarkup } from "./application-emoji"

/** Faction keys of event messages and their fixed application emoji. */
export function factionEmojiFromMarkup(
    markup: PanelEmojiMarkup
): PanelFactionEmoji {
    const emoji: PanelFactionEmoji = {}
    // The generic side signs: an event names a side, not the map's nation.
    if (markup.allies) emoji.allies = markup.allies
    if (markup.axis) emoji.axis = markup.axis
    if (markup.valkyra) emoji.valkyra = markup.valkyra
    if (markup.manticore) emoji.manticore = markup.manticore
    if (markup.lonestar) emoji.lonestar = markup.lonestar
    return emoji
}

/**
 * Faction emblems for event messages: the fixed application emoji the bot
 * provisions itself (refreshed hourly). A failed lookup yields no emoji, so
 * messages use the fallback emblems and event sync never waits on or fails
 * because of it.
 */
export async function applicationFactionEmoji(
    client: Client
): Promise<PanelFactionEmoji> {
    try {
        return factionEmojiFromMarkup(await applicationEmoji(client).emoji())
    } catch {
        return {}
    }
}
