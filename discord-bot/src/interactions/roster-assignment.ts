/**
 * The roster's private views (board L1 1.11): "Zobrazit zařazení" (Moje
 * zařazení, the only place with the server password), "Zobrazit soupisku"
 * (one squad with its confirmations and a select of all squads) and
 * "Zobrazit celou soupisku" (the whole text roster, paged, for rosters too
 * long for the roster message). In the server the replies are private; from
 * a DM they arrive as normal messages in the same DM.
 */

import {
    MessageFlags,
    type ButtonInteraction,
    type Guild,
    type StringSelectMenuInteraction,
} from "discord.js"

import {
    findMyAssignment,
    myAssignmentView,
    parseSquadSelection,
    rosterButtonIds,
    rosterFullView,
    rosterSquadView,
} from "../../../src/domain/discord-messages/roster-message"
import type {
    DiscordConfig,
    EventInteractionContext,
    EventRecord,
    Group,
    Roster,
} from "../types"
import {
    eventGuild,
    memberNames,
    rosterCardContext,
    rosterCardEvent,
} from "../events/match-context"
import {
    editPayload,
    interactionReplyPayload,
    type MessageKitOptions,
} from "../ui/message-kit"
import {
    errorCard,
    type MessageView,
} from "../../../src/domain/discord-messages/message-view"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { getSystemMessages } from "../../../src/lib/clan-language/system"
import { replyPrivately, type PrivateReplyTarget } from "../ui/replies"
import type { InteractionFeature } from "./registry"
import { convex, references } from "../convex"
import { env } from "../environment"

// The routes follow the custom IDs the cards use.
const ASSIGNMENT_PREFIX = rosterButtonIds.assignment("")
const SQUADS_PREFIX = rosterButtonIds.squads("")
const SQUAD_SELECT_PREFIX = rosterButtonIds.squadSelect("")
const FULL_PREFIX = "roster-full:"

type RosterContext = Pick<
    EventInteractionContext,
    "config" | "event" | "roster"
> & {
    groups?: Group[]
}

function kitOptions(config: DiscordConfig): MessageKitOptions {
    return { language: config.defaultLanguage, style: config.messageStyle }
}

function cardRoster(roster: Roster) {
    return {
        squads: roster.squads,
        reservePlayerIds: roster.reservePlayerIds,
        notAttendingPlayerIds: roster.notAttendingPlayerIds,
        reserveAttendances: roster.reserveAttendances,
        published: roster.published,
    }
}

function rosterUserIds(roster: Roster | null | undefined) {
    return [
        ...(roster?.squads ?? []).flatMap((squad) =>
            squad.players.flatMap((player) => (player.id ? [player.id] : []))
        ),
        ...(roster?.reservePlayerIds ?? []),
        ...(roster?.notAttendingPlayerIds ?? []),
    ]
}

/** "Moje zařazení" for one player; the leader is named, never pinged. */
export function buildMyAssignmentView(input: {
    context: RosterContext
    userId: string
    names?: Readonly<Record<string, string>>
    now?: number
}): MessageView {
    const { config, event, roster } = input.context
    return myAssignmentView({
        event: rosterCardEvent(event, config),
        assignment: findMyAssignment(
            roster ? cardRoster(roster) : null,
            input.userId
        ),
        context: rosterCardContext({
            config,
            eventId: event.id,
            names: input.names ?? {},
            now: input.now,
        }),
    })
}

/** The private reply behind "Zobrazit zařazení". */
export function buildRosterAssignmentReply(input: {
    config: DiscordConfig
    event: EventRecord
    roster: Roster | null
    userId: string
    names?: Readonly<Record<string, string>>
    now?: number
}) {
    return interactionReplyPayload(
        buildMyAssignmentView({
            context: input,
            userId: input.userId,
            names: input.names,
            now: input.now,
        }),
        kitOptions(input.config)
    )
}

/** "Zobrazit soupisku": one squad, or the reserves. */
export function buildSquadView(input: {
    context: RosterContext & { roster: Roster }
    selected?: number | "reserves"
    names?: Readonly<Record<string, string>>
    now?: number
}): MessageView {
    const { config, event, roster } = input.context
    return rosterSquadView({
        event: rosterCardEvent(event, config),
        roster: cardRoster(roster),
        selected: input.selected,
        context: rosterCardContext({
            config,
            eventId: event.id,
            names: input.names ?? {},
            groups: input.context.groups,
            now: input.now,
        }),
    })
}

/** "Zobrazit celou soupisku": the whole text roster, one page. */
export function buildFullRosterView(input: {
    context: RosterContext & { roster: Roster }
    page: number
    names?: Readonly<Record<string, string>>
}): MessageView {
    const { config, event, roster } = input.context
    return rosterFullView({
        event: rosterCardEvent(event, config),
        roster: cardRoster(roster),
        page: input.page,
        context: rosterCardContext({
            config,
            eventId: event.id,
            names: input.names ?? {},
            groups: input.context.groups,
        }),
        paging: getSystemMessages(config.defaultLanguage).paging,
    })
}

async function loadContext(eventId: string) {
    return (await convex
        .query(references.getEventInteractionContext, {
            secret: env.internalSecret,
            eventId: eventId as never,
        })
        .catch(() => null)) as EventInteractionContext | null
}

/** Private in the server; a normal message in a DM (no "only you" line). */
export async function replyCard(
    interaction: PrivateReplyTarget & { guildId: string | null },
    view: MessageView,
    options: MessageKitOptions
) {
    if (interaction.guildId) {
        await replyPrivately(interaction, view, options)
        return
    }
    const payload = interactionReplyPayload(
        { ...view, ephemeral: false },
        options
    )
    if (interaction.deferred || interaction.replied)
        await interaction.followUp(payload)
    else await interaction.reply(payload)
}

/**
 * The event's context for a roster button. The reply can carry the server
 * password, so it must come from the event's own guild (or a DM).
 */
async function contextFor(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    eventId: string
) {
    const context = await loadContext(eventId)
    if (
        context &&
        (!interaction.guildId || interaction.guildId === context.event.guildId)
    )
        return context
    const language = context?.config.defaultLanguage
    const copy = getDirectMessages(language).replies
    await replyCard(
        interaction,
        errorCard({
            title: copy.unavailableTitle,
            body: copy.unavailableBody,
        }),
        { language }
    )
    return null
}

async function guildOf(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    guildId: string
): Promise<Guild | null> {
    return interaction.guild ?? (await eventGuild(interaction.client, guildId))
}

/** "Zobrazit zařazení". */
async function handleAssignment(interaction: ButtonInteraction) {
    const eventId = interaction.customId.slice(ASSIGNMENT_PREFIX.length)
    const context = await contextFor(interaction, eventId)
    if (!context) return
    const squad = context.roster?.squads.find((item) =>
        item.players.some((player) => player.id === interaction.user.id)
    )
    const names = await memberNames(
        await guildOf(interaction, context.event.guildId),
        squad?.players.flatMap((player) => (player.id ? [player.id] : [])) ?? []
    )
    await replyCard(
        interaction,
        buildMyAssignmentView({
            context,
            userId: interaction.user.id,
            names,
        }),
        kitOptions(context.config)
    )
}

async function squadContext(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    eventId: string
) {
    const context = await contextFor(interaction, eventId)
    if (!context) return null
    if (!context.roster?.published) {
        const copy = getDirectMessages(context.config.defaultLanguage).replies
        await replyCard(
            interaction,
            errorCard({
                title: copy.notPublishedTitle,
                body: copy.notPublishedBody,
            }),
            kitOptions(context.config)
        )
        return null
    }
    const names = await memberNames(
        await guildOf(interaction, context.event.guildId),
        rosterUserIds(context.roster)
    )
    return {
        context: {
            ...context,
            roster: context.roster,
            groups: context.groups,
        },
        names,
    }
}

/** "Zobrazit soupisku" from the roster message. */
async function handleSquads(interaction: ButtonInteraction) {
    const eventId = interaction.customId.slice(SQUADS_PREFIX.length)
    const loaded = await squadContext(interaction, eventId)
    if (!loaded) return
    await replyCard(
        interaction,
        buildSquadView({ ...loaded, selected: 0 }),
        kitOptions(loaded.context.config)
    )
}

/** The squad select edits the private reply in place. */
async function handleSquadSelect(interaction: StringSelectMenuInteraction) {
    const eventId = interaction.customId.slice(SQUAD_SELECT_PREFIX.length)
    const loaded = await squadContext(interaction, eventId)
    if (!loaded) return
    const view = buildSquadView({
        ...loaded,
        selected: parseSquadSelection(interaction.values[0]),
    })
    await interaction.update(
        editPayload(
            interaction.guildId ? view : { ...view, ephemeral: false },
            kitOptions(loaded.context.config)
        )
    )
}

/** "Zobrazit celou soupisku" and its paging buttons. */
async function handleFullRoster(interaction: ButtonInteraction) {
    const [, eventId = "", rawPage] = interaction.customId.split(":")
    const loaded = await squadContext(interaction, eventId)
    if (!loaded) return
    const view = buildFullRosterView({
        ...loaded,
        page: Number(rawPage) || 1,
    })
    const options = kitOptions(loaded.context.config)
    // Paging inside the private reply edits it; the roster message opens one.
    if (interaction.message.flags.has(MessageFlags.Ephemeral))
        await interaction.update(editPayload(view, options))
    else await replyCard(interaction, view, options)
}

export const rosterInteractions: InteractionFeature = {
    name: "roster",
    register(registry) {
        registry
            .button(ASSIGNMENT_PREFIX, handleAssignment)
            .button(SQUADS_PREFIX, handleSquads)
            .button(FULL_PREFIX, handleFullRoster)
            .stringSelect(SQUAD_SELECT_PREFIX, handleSquadSelect)
    },
}
