import {
    playerListOutdatedView,
    playerListUnavailableView,
    playerListView,
    type PlayerListSide,
} from "../../../src/domain/discord-publications/player-list"
import {
    hllSideSign,
    wardogsSign,
    type PanelEmojiMarkup,
} from "../../../src/domain/discord-publications/live-panel"
import { panelImageCopy } from "../../../src/domain/discord-publications/panel-image-copy"
import type { LiveServerFacts } from "../../../src/domain/discord-publications/live-panel"
import { WARDOGS_FACTIONS } from "../../../src/domain/discord-publications/panel-emblems"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getPanelMessages } from "../../../src/lib/clan-language/panels"
import { hllMapArtwork } from "../../../src/domain/game-data/hll-live"
import { playerControl } from "./player-details"

/**
 * Bot-side helpers of the live panels: the packaged map art path and the
 * private "Zobrazit hráče" reply built from the shared domain view.
 */

/** Packaged art for a map (used for League cards and `/stats`). */
export function artworkPath(game: string, map?: string | null) {
    const key = map?.trim().toLowerCase()
    if (
        game === "wardogs" &&
        key &&
        ["bakurani", "ozeti", "zestafona"].includes(key)
    )
        return `/maps/wardogs/${key}.webp`
    return game === "wardogs"
        ? "/img/games/wardogs.jpg"
        : game === "hell_let_loose"
          ? hllMapArtwork(map)
          : null
}

/** The sides of the list in display order, with their signs. */
export function playerListSides(
    facts: Pick<LiveServerFacts, "game" | "hll" | "wardogs">,
    emoji: PanelEmojiMarkup,
    language?: string
): PlayerListSide[] {
    const copy = getPanelMessages(language).live
    if (facts.game === "hell_let_loose")
        return (["allies", "axis"] as const).map((side) => ({
            key: side,
            label: copy[side],
            sign: hllSideSign(side, facts.hll?.nations ?? null, emoji),
        }))
    const known = facts.wardogs?.factions ?? []
    const names = known.length
        ? known.map((faction) => ({ key: faction.name, faction: faction.key }))
        : WARDOGS_FACTIONS.map((faction) => ({
              key: faction,
              faction,
          }))
    const words = panelImageCopy(language)
    return names.map((entry) => ({
        key: entry.key,
        label: entry.faction ? words.wardogs[entry.faction] : entry.key,
        sign: wardogsSign(entry.faction, emoji),
    }))
}

/**
 * "Zobrazit hráče" (P4-40..43): the current round's players, eight per page,
 * by side or faction; the unavailable or outdated card otherwise.
 */
export function panelPlayersView(input: {
    panel: { _id: string; revision: number; title?: string | null }
    serverName: string | null
    facts: LiveServerFacts | null
    page: number
    language?: string
    emoji: PanelEmojiMarkup
}): MessageView {
    const copy = getPanelMessages(input.language)
    const facts = input.facts
    if (!facts) return playerListOutdatedView(copy.players)
    if (!facts.rosterFresh) return playerListUnavailableView(copy.players)
    return playerListView({
        copy: copy.players,
        locale: panelImageCopy(input.language).locale,
        game: facts.game,
        serverTitle:
            input.panel.title?.trim() ||
            input.serverName ||
            facts.serverName ||
            "—",
        mapName: facts.map?.name ?? null,
        playerCount: facts.players ?? facts.roster.length,
        roster: facts.roster,
        rosterAt: facts.rosterAt,
        sides: playerListSides(facts, input.emoji, input.language),
        otherSide: { key: "", label: copy.players.noSide, sign: "" },
        page: input.page,
        id: (page, action) =>
            playerControl(input.panel._id, input.panel.revision, page, action),
    })
}
