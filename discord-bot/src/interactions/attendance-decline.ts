import {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type ModalSubmitInteraction,
} from "discord.js"

import { DECLINE_REASON_MAX_LENGTH } from "../../../src/domain/rosters/attendance-decline"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import type { EventInteractionContext } from "../types"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { logInfo } from "../log"

type Messages = ReturnType<typeof getEventMessages>
type Options = {
    enqueueEventSync: (eventId: string) => void
    triggerPollSoon: () => void
}
export type DeclineResult = {
    ok: boolean
    changed: boolean
    rejected:
        | "roster_not_published"
        | "too_late"
        | "not_on_roster"
        | "invalid_reason"
        | null
}

export const ATTENDANCE_DECLINE_PREFIX = "attendance-decline:"
export const ATTENDANCE_DECLINE_MODAL_PREFIX = "attendance-decline-modal:"

/** The optional reason form behind "Can't make it". */
export function buildAttendanceDeclineModal(
    eventId: string,
    messages: Messages
) {
    return new ModalBuilder()
        .setCustomId(`${ATTENDANCE_DECLINE_MODAL_PREFIX}${eventId}`)
        .setTitle(messages.attendanceDecline.modalTitle.slice(0, 45))
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel(
                        messages.attendanceDecline.reasonLabel.slice(0, 45)
                    )
                    .setPlaceholder(
                        messages.attendanceDecline.reasonPlaceholder.slice(
                            0,
                            100
                        )
                    )
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(DECLINE_REASON_MAX_LENGTH)
            )
        )
}

/**
 * Why a player cannot decline right now, checked before the form opens; null
 * when they can. Players on the published roster (squads or reserves) may
 * decline until the game starts.
 */
export function declineRefusal(
    context: Pick<EventInteractionContext, "event" | "roster">,
    userId: string,
    messages: Messages,
    now = Date.now()
) {
    const roster = context.roster
    if (!roster?.published) return messages.interaction.rosterNotPublished
    const onRoster =
        roster.squads.some((squad) =>
            squad.players.some((player) => player.id === userId)
        ) || roster.reservePlayerIds.includes(userId)
    if (!onRoster) return messages.interaction.notOnRoster
    const gameStart = Date.parse(context.event.gameStart)
    if (
        context.event.status === "concluded" ||
        !Number.isFinite(gameStart) ||
        now >= gameStart
    )
        return messages.attendanceDecline.tooLate
    return null
}

/** Reply text for the backend's answer. */
export function declineReply(result: DeclineResult, messages: Messages) {
    switch (result.rejected) {
        case "roster_not_published":
            return messages.interaction.rosterNotPublished
        case "not_on_roster":
            return messages.interaction.notOnRoster
        case "too_late":
            return messages.attendanceDecline.tooLate
        case "invalid_reason":
            return messages.interaction.unableToLoadEventContext
    }
    return result.changed
        ? messages.attendanceDecline.saved
        : messages.attendanceDecline.alreadySaved
}

async function loadContext(eventId: string) {
    return (await convex
        .query(references.getEventInteractionContext, {
            secret: env.internalSecret,
            eventId: eventId as never,
        })
        .catch(() => null)) as EventInteractionContext | null
}

/** The context must come from the event's own guild (or a DM). */
function belongsHere(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    context: EventInteractionContext
) {
    return !interaction.guildId || interaction.guildId === context.event.guildId
}

export async function handleAttendanceDeclineButton(
    interaction: ButtonInteraction
) {
    const eventId = interaction.customId.slice(ATTENDANCE_DECLINE_PREFIX.length)
    const context = await loadContext(eventId)
    if (!context || !belongsHere(interaction, context)) {
        await interaction.reply({
            content: getEventMessages(context?.config.defaultLanguage)
                .interaction.unableToLoadEventContext,
            flags: interaction.guildId ? MessageFlags.Ephemeral : undefined,
        })
        return
    }
    const messages = getEventMessages(context.config.defaultLanguage)
    const refusal = declineRefusal(context, interaction.user.id, messages)
    if (refusal) {
        await interaction.reply({
            content: refusal,
            flags: interaction.guildId ? MessageFlags.Ephemeral : undefined,
        })
        return
    }
    await interaction.showModal(buildAttendanceDeclineModal(eventId, messages))
}

export async function handleAttendanceDeclineModalSubmit(
    interaction: ModalSubmitInteraction,
    options: Options
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const eventId = interaction.customId.slice(
        ATTENDANCE_DECLINE_MODAL_PREFIX.length
    )
    const context = await loadContext(eventId)
    if (!context || !belongsHere(interaction, context)) {
        await interaction.editReply({
            content: getEventMessages(context?.config.defaultLanguage)
                .interaction.unableToLoadEventContext,
        })
        return
    }
    const messages = getEventMessages(context.config.defaultLanguage)
    const typed = interaction.fields.getTextInputValue("reason").trim()
    const result = (await convex.mutation(references.declineAttendance, {
        secret: env.internalSecret,
        guildId: context.event.guildId,
        eventId: context.event.id as never,
        userId: interaction.user.id,
        reason: typed || messages.attendanceDecline.defaultReason,
    })) as DeclineResult
    if (result.changed) {
        await revalidateAppData(
            context.roster
                ? {
                      type: "roster-changed",
                      serverId: context.event.guildId,
                      rosterId: context.roster.id,
                      eventId: context.event.id,
                  }
                : {
                      type: "event-changed",
                      serverId: context.event.guildId,
                      eventId: context.event.id,
                  }
        )
        options.enqueueEventSync(context.event.id)
        options.triggerPollSoon()
        logInfo("interaction", "Recorded a declined roster place", {
            eventId: context.event.id,
            guildId: context.event.guildId,
            userId: interaction.user.id,
        })
    }
    await interaction.editReply({ content: declineReply(result, messages) })
}
