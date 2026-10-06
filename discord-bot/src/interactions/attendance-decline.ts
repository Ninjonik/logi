import {
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type ModalSubmitInteraction,
} from "discord.js"

import {
    attendanceModalCopy,
    declineSavedReply,
    matchStartedReply,
    simpleReply,
    type DmFrame,
} from "../../../src/domain/discord-messages/direct-message-views"
import {
    eventCustomId,
    parseEventButtonId,
} from "../../../src/domain/discord-messages/roster-message"
import { DECLINE_REASON_MAX_LENGTH } from "../../../src/domain/rosters/attendance-decline"
import { attendanceAnswerWindow } from "../../../src/domain/rosters/attendance-window"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { matchTitle } from "../../../src/domain/discord-messages/match-text"
import type { EventInteractionContext } from "../types"
import { matchReplyKit } from "../runtime/clan-kit"
import { replyFrame } from "./attendance-replies"
import { replyUnknownError } from "../ui/replies"
import { replyCard } from "./roster-assignment"
import { postAttendanceNotice } from "../forum"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { logInfo } from "../log"

type Copy = ReturnType<typeof getDirectMessages>
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

/** The optional reason form behind "Nemůžu", titled with the match (L2-33). */
export function buildAttendanceDeclineModal(
    context: Pick<EventInteractionContext, "config" | "event">
) {
    const copy = attendanceModalCopy(
        "decline",
        matchTitle(context.event),
        getDirectMessages(context.config.defaultLanguage)
    )
    // The form names the server like the DM button that opens it.
    return new ModalBuilder()
        .setCustomId(
            eventCustomId(
                ATTENDANCE_DECLINE_MODAL_PREFIX,
                context.event.id,
                context.event.guildId
            )
        )
        .setTitle(copy.title.slice(0, 45))
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel(copy.label.slice(0, 45))
                    .setPlaceholder(copy.placeholder.slice(0, 100))
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(copy.required)
                    .setMaxLength(DECLINE_REASON_MAX_LENGTH)
            )
        )
}

type Where = { dm: boolean; frame?: DmFrame }

/**
 * Why a player cannot decline right now, checked before the form opens; null
 * when they can. Players on the published roster (squads or reserves) may
 * decline until the game starts (L2-B07).
 */
export function declineRefusal(
    context: Pick<EventInteractionContext, "event" | "roster">,
    userId: string,
    copy: Copy,
    where: Where,
    now = Date.now()
): MessageView | null {
    const roster = context.roster
    if (!roster?.published)
        return simpleReply({
            title: copy.replies.notPublishedTitle,
            body: copy.replies.notPublishedBody,
            ...where,
        })
    const onRoster =
        roster.squads.some((squad) =>
            squad.players.some((player) => player.id === userId)
        ) || roster.reservePlayerIds.includes(userId)
    if (!onRoster)
        return simpleReply({
            title: copy.replies.notOnRosterTitle,
            body: copy.replies.notOnRosterBody,
            ...where,
        })
    if (attendanceAnswerWindow(context.event, now) === "started")
        return matchStartedReply({ copy, ...where })
    return null
}

/** The reply card for the backend's answer (L2-34). */
export function declineReply(
    result: DeclineResult,
    copy: Copy,
    where: Where & { squad?: string }
): MessageView {
    switch (result.rejected) {
        case "roster_not_published":
            return simpleReply({
                title: copy.replies.notPublishedTitle,
                body: copy.replies.notPublishedBody,
                ...where,
            })
        case "not_on_roster":
            return simpleReply({
                title: copy.replies.notOnRosterTitle,
                body: copy.replies.notOnRosterBody,
                ...where,
            })
        case "too_late":
            return matchStartedReply({ copy, ...where })
        case "invalid_reason":
            return simpleReply({
                title: copy.replies.unavailableTitle,
                body: copy.replies.unavailableBody,
                ...where,
            })
    }
    return declineSavedReply({
        squad: where.squad,
        alreadySaved: !result.changed,
        copy,
        dm: where.dm,
        frame: where.frame,
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

/** The context must come from the event's own guild (or a DM). */
function belongsHere(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    context: EventInteractionContext
) {
    return !interaction.guildId || interaction.guildId === context.event.guildId
}

function kitOptions(context: EventInteractionContext) {
    return {
        language: context.config.defaultLanguage,
        style: context.config.messageStyle,
    }
}

export async function handleAttendanceDeclineButton(
    interaction: ButtonInteraction
) {
    const button = parseEventButtonId(
        interaction.customId,
        ATTENDANCE_DECLINE_PREFIX
    )
    const context = await loadContext(button.eventId)
    if (!context || !belongsHere(interaction, context)) {
        // In the clan language also in a DM (L1-B19, L2-B01).
        const kit = await matchReplyKit({
            context,
            guildId: interaction.guildId,
            customIdGuildId: button.guildId,
        })
        const copy = getDirectMessages(kit.language)
        await replyCard(
            interaction,
            simpleReply({
                title: copy.replies.unavailableTitle,
                body: copy.replies.unavailableBody,
                dm: !interaction.guildId,
            }),
            kit
        )
        return
    }
    const copy = getDirectMessages(context.config.defaultLanguage)
    const refusal = declineRefusal(context, interaction.user.id, copy, {
        dm: !interaction.guildId,
        frame: await replyFrame(interaction, context),
    })
    if (refusal) {
        await replyCard(interaction, refusal, kitOptions(context))
        return
    }
    await interaction.showModal(buildAttendanceDeclineModal(context))
}

export async function handleAttendanceDeclineModalSubmit(
    interaction: ModalSubmitInteraction,
    options: Options
) {
    await interaction.deferReply(
        interaction.guildId ? { flags: MessageFlags.Ephemeral } : {}
    )
    const form = parseEventButtonId(
        interaction.customId,
        ATTENDANCE_DECLINE_MODAL_PREFIX
    )
    const context = await loadContext(form.eventId)
    if (!context || !belongsHere(interaction, context)) {
        await replyUnknownError(
            interaction,
            await matchReplyKit({
                context,
                guildId: interaction.guildId,
                customIdGuildId: form.guildId,
            })
        )
        return
    }
    const copy = getDirectMessages(context.config.defaultLanguage)
    const typed = interaction.fields.getTextInputValue("reason").trim()
    const squad = context.roster?.squads.find((item) =>
        item.players.some((player) => player.id === interaction.user.id)
    )
    const result = (await convex.mutation(references.declineAttendance, {
        secret: env.internalSecret,
        guildId: context.event.guildId,
        eventId: context.event.id as never,
        userId: interaction.user.id,
        reason: typed || copy.replies.defaultDeclineReason,
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
        await postAttendanceNotice(interaction.client, {
            context,
            userId: interaction.user.id,
            kind: "absent",
        })
    }
    await replyCard(
        interaction,
        declineReply(result, copy, {
            dm: !interaction.guildId,
            frame: await replyFrame(interaction, context),
            squad: squad?.name,
        }),
        kitOptions(context)
    )
}
