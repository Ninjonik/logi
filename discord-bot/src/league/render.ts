import type { MessageCreateOptions } from "discord.js"

import {
    leagueFixturesMessage,
    leagueLinkReplyMessage,
    leagueStandingsMessage,
    type LeaguePanelLook,
} from "../../../src/domain/wardogs-league/panel-views"
import type {
    LeagueFixturesView,
    LeagueStandingsView,
} from "../../../src/domain/wardogs-league/panels"
import type { PanelEmojiMarkup } from "../../../src/domain/discord-publications/live-panel"
import type { LeagueLinkReplyView } from "../../../src/domain/wardogs-league/link-reply"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import type { MessageMedia } from "../../../src/domain/discord-messages/message-view"
import type { ChipTone } from "../../../src/domain/discord-messages/message-view"
import { extractMatchUrls } from "../../../src/domain/wardogs-league/discovery"
import { messageKitLayoutOptions, messagePayload } from "../ui/message-kit"
import { getLeagueMessages } from "../../../src/lib/clan-language/league"

/**
 * Discord payloads of the WD League panels ("tabulka", "nejbližší zápasy"
 * with the recent results) and of the reply to a posted League link. The
 * views come from the shared domain builders; this file only adds the clan
 * look (language, colour, icons) and turns them into payloads.
 */
export type LeagueRenderContext = {
    language: string
    timeZone: string
    style: MessageStyle | null
    emoji: PanelEmojiMarkup
    chipIcons?: Partial<Record<ChipTone, string>>
    accentColor: string | null
    paused: { since: number | null } | null
    now: number
}

export function leagueLook(context: LeagueRenderContext): LeaguePanelLook {
    const copy = getLeagueMessages(context.language)
    return {
        copy,
        locale: copy.locale,
        timeZone: context.timeZone,
        accentColor: context.accentColor,
        layout: messageKitLayoutOptions({
            language: context.language,
            style: context.style,
            chipIcons: context.chipIcons,
        }),
        emoji: {
            valkyra: context.emoji.valkyra,
            manticore: context.emoji.manticore,
            lonestar: context.emoji.lonestar,
        },
        chipIcons: context.chipIcons,
        paused: context.paused,
        now: context.now,
    }
}

const kitOptions = (context: LeagueRenderContext) => ({
    language: context.language,
    style: context.style,
    chipIcons: context.chipIcons,
})

/** "WD League · tabulka" as a message. */
export function standingsPayload(
    view: LeagueStandingsView,
    context: LeagueRenderContext
): MessageCreateOptions {
    return messagePayload(
        leagueStandingsMessage(view, leagueLook(context)),
        kitOptions(context)
    )
}

/** "WD League · nejbližší zápasy" (or "poslední výsledky" alone) as a message. */
export function fixturesPayload(
    view: LeagueFixturesView,
    context: LeagueRenderContext,
    options: {
        fixtures: boolean
        thumbnails?: ReadonlyMap<string, MessageMedia>
    }
) {
    const message = leagueFixturesMessage(view, leagueLook(context), options)
    return {
        view: message,
        payload: messagePayload(message, kitOptions(context)),
    }
}

/** The reply under a posted League link (L3-56). */
export function linkReplyPayload(
    reply: LeagueLinkReplyView,
    context: Pick<
        LeagueRenderContext,
        "language" | "timeZone" | "style" | "accentColor"
    >
): MessageCreateOptions {
    const copy = getLeagueMessages(context.language)
    return messagePayload(
        leagueLinkReplyMessage(reply, {
            copy,
            locale: copy.locale,
            timeZone: context.timeZone,
            accentColor: context.accentColor,
        }),
        { language: context.language, style: context.style }
    )
}

/**
 * League links of a human message in the links channel. Edits are always
 * read so a removed link can be forgotten after the room changed.
 */
export function humanLeagueInput(
    message: {
        guildId: string | null
        channelId: string
        bot: boolean
        webhookId: string | null
        content: string
    },
    inputChannelId: string | null,
    receivedEdit = false
) {
    return !message.guildId ||
        message.bot ||
        message.webhookId ||
        (!receivedEdit && message.channelId !== inputChannelId)
        ? null
        : extractMatchUrls(message.content)
}
