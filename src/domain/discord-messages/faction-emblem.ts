import {
    NEUTRAL_FACTION_MARKER,
    panelFactionOf,
    type PanelFaction,
    type PanelFactionEmoji,
} from "@/domain/discord-publications/panel-presentation"

/**
 * Emblems used when no application emoji or workspace override exists: the
 * Hell Let Loose team colours (Allies blue, Axis red) and the neutral marker
 * for Wardogs factions, as on the score panels.
 */
export const FALLBACK_FACTION_EMBLEMS: Record<PanelFaction, string> = {
    allies: "🟦",
    axis: "🟥",
    valkyra: NEUTRAL_FACTION_MARKER,
    manticore: NEUTRAL_FACTION_MARKER,
    lonestar: NEUTRAL_FACTION_MARKER,
}

/**
 * The emblem shown before a faction ("Allies", "Axis", "Valkyra", ...): the
 * installed emoji when there is one, else the fallback. Labels that are not a
 * known faction (provider team names, free text) have no emblem.
 */
export function factionEmblem(
    label: string | null | undefined,
    emoji: PanelFactionEmoji = {}
): string | undefined {
    const faction = panelFactionOf(label)
    return faction
        ? (emoji[faction] ?? FALLBACK_FACTION_EMBLEMS[faction])
        : undefined
}
