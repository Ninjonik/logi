/**
 * The Discord resources around a match in the clan language (board L1 1.14):
 * the scheduled event's name and description, the match roles "VLK vs ROG ·
 * Hráči"/"· Zálohy" and the squad voice channels "F1 · Pěchota" in the
 * category "Čety · VLK vs ROG".
 */

import {
    matchRoleNames,
    squadCategoryName,
    squadVoiceChannelName,
} from "../../../src/domain/events/match-discord-names"
import {
    matchCardFullTitle,
    matchCardTitle,
} from "../../../src/domain/discord-messages/match-announcement"
import { buildScheduledEventContent } from "../../../src/application/discord-sync/scheduled-event-content"
import { panelFactionOf } from "../../../src/domain/discord-publications/panel-presentation"
import { getAnnouncementMessages } from "../../../src/lib/clan-language/announcements"
import { plainText } from "../../../src/domain/events/calendar-link"
import type { EventRecord, SyncPayload } from "../types"
import { matchCardEventOf } from "./announcement"

/**
 * The other team, for "Přátelák proti ROG": the team on the other side than
 * the clan, else the second team by slot.
 */
function opponentOf(
    teams: ReadonlyArray<{ code: string; side: string | null }>,
    clanSide: string | null | undefined
) {
    if (teams.length < 2) return null
    const own = panelFactionOf(clanSide) ?? clanSide?.trim().toLowerCase()
    const byOther = own
        ? teams.find((team) => {
              const side =
                  panelFactionOf(team.side) ?? team.side?.trim().toLowerCase()
              return side && side !== own
          })
        : undefined
    return (byOther ?? teams[1])?.code ?? null
}

/** Name and description of the match's Discord scheduled event. */
export function scheduledEventContentFor(
    payload: Pick<SyncPayload, "config" | "guild">,
    event: EventRecord,
    announcementChannelId: string | undefined
) {
    const copy = getAnnouncementMessages(payload.config.defaultLanguage)
    const card = matchCardEventOf({
        config: payload.config,
        event,
        categories: payload.guild.eventCategories,
    })
    return buildScheduledEventContent({
        kind: event.kind,
        title: matchCardFullTitle(card, copy),
        category: card.category?.label ?? null,
        opponent: opponentOf(card.teams, event.side),
        side: event.side ?? null,
        mapLabel: card.mapLabel ? plainText(card.mapLabel) : null,
        server: event.kind === "training" ? (event.server ?? null) : null,
        hasPassword: Boolean(event.serverPassword?.trim()),
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        announcementChannelId: announcementChannelId ?? null,
        locale: card.locale,
        timeZone: payload.config.timezone,
        copy,
    })
}

/** "VLK vs ROG · Hráči" and "VLK vs ROG · Zálohy" (L1-145). */
export function matchRoleNamesFor(
    payload: Pick<SyncPayload, "config" | "guild">,
    event: EventRecord
) {
    const copy = getAnnouncementMessages(payload.config.defaultLanguage)
    const card = matchCardEventOf({
        config: payload.config,
        event,
        categories: payload.guild.eventCategories,
    })
    return matchRoleNames(matchCardTitle(card, copy), copy)
}

/** "Čety · VLK vs ROG": the category of the squad voice channels (L1-144). */
export function squadCategoryNameFor(
    payload: Pick<SyncPayload, "config" | "guild">,
    event: EventRecord
) {
    const copy = getAnnouncementMessages(payload.config.defaultLanguage)
    const card = matchCardEventOf({
        config: payload.config,
        event,
        categories: payload.guild.eventCategories,
    })
    return squadCategoryName(matchCardTitle(card, copy), copy)
}

/** "F1 · Pěchota" (L1-144). */
export function squadVoiceChannelNameFor(
    squad: { name: string; group?: string | null },
    language: SyncPayload["config"]["defaultLanguage"]
) {
    return squadVoiceChannelName(squad, getAnnouncementMessages(language))
}
