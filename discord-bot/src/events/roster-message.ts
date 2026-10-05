/**
 * The published roster message in the roster channel (board L1 1.11): the
 * roster photo as the old bot posted it, with the text roster under it
 * (variant A, the default) or the photo only (variant B), chosen when the
 * roster is published. Optional mentions of the rostered players sit above
 * the card and ping only when the message is first posted.
 */

import { TextDisplayBuilder, type MessageCreateOptions } from "discord.js"

import { resolveRosterMessageVariant } from "../../../src/domain/discord-messages/notification-settings"
import {
    rosterMentionIds,
    rosterMessageView,
} from "../../../src/domain/discord-messages/roster-message"
import type { MessageMedia } from "../../../src/domain/discord-messages/message-view"
import { messageKitLayoutOptions, messagePayload } from "../ui/message-kit"
import type { EventRecord, Roster, SyncPayload } from "../types"
import { rosterCardContext, rosterCardEvent } from "./match-context"

/** Discord pings at most 100 users per message. */
const MAX_USER_MENTIONS = 100

export function buildRosterMessage(input: {
    payload: Pick<SyncPayload, "config" | "guild" | "groups">
    event: EventRecord
    roster: Roster
    names: Readonly<Record<string, string>>
    image: MessageMedia
    now?: number
}): MessageCreateOptions {
    const { payload, event, roster } = input
    const options = {
        language: payload.config.defaultLanguage,
        style: payload.config.messageStyle,
    }
    const view = rosterMessageView(
        {
            event: rosterCardEvent(
                event,
                payload.config,
                payload.guild.eventCategories
            ),
            roster: {
                squads: roster.squads,
                reservePlayerIds: roster.reservePlayerIds,
                notAttendingPlayerIds: roster.notAttendingPlayerIds,
                reserveAttendances: roster.reserveAttendances,
            },
            variant: resolveRosterMessageVariant(
                roster.discordMessageVariant,
                payload.config
            ),
            image: input.image,
            publishedAt: roster.publishedAt ?? roster.updatedAt,
        },
        rosterCardContext({
            config: payload.config,
            eventId: event.id,
            names: input.names,
            groups: payload.groups,
            now: input.now,
        }),
        messageKitLayoutOptions(options)
    )
    const message = messagePayload(view, options)
    const mentions = roster.discordMentionPlayers
        ? rosterMentionIds(roster).slice(0, MAX_USER_MENTIONS)
        : []
    if (!mentions.length) return message
    return {
        ...message,
        components: [
            new TextDisplayBuilder().setContent(
                mentions.map((id) => `<@${id}>`).join(" ")
            ),
            ...message.components,
        ],
        // Pings only on the first post; edits never notify.
        allowedMentions: { users: mentions, parse: [] },
    }
}
