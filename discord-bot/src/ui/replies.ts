/**
 * Private replies and the one error path of the bot (board M3): every
 * command and button error is a private card in the clan colour and the
 * clan language; an error only an admin can fix also goes to the errors
 * channel and the person reads only "správci dostali upozornění".
 */

import type {
    Client,
    InteractionEditReplyOptions,
    InteractionReplyOptions,
    MessageEditOptions,
} from "discord.js"

import {
    adminFixableErrorCard,
    unknownErrorCard,
    type MessageView,
} from "../../../src/domain/discord-messages/message-view"
import {
    editPayload,
    interactionReplyPayload,
    type MessageKitOptions,
} from "./message-kit"
import {
    reportClanDiscordError,
    type ClanErrorReportInput,
} from "../error-reporting"
import {
    cachedClanLanguage,
    clanLanguageForGuild,
} from "../runtime/clan-language"
import { getSystemMessages } from "../../../src/lib/clan-language/system"
import { logWarn } from "../log"

/** The parts of a repliable interaction the kit needs; real interactions fit. */
export type PrivateReplyTarget = {
    deferred: boolean
    replied: boolean
    /** Whether the deferral or first reply was ephemeral (discord.js tracks it). */
    ephemeral?: boolean | null
    reply(options: InteractionReplyOptions): Promise<unknown>
    editReply(options: InteractionEditReplyOptions): Promise<unknown>
    followUp(options: InteractionReplyOptions): Promise<unknown>
    deleteReply(): Promise<unknown>
}

/**
 * Sends a view only the person sees. A private deferral is completed in
 * place; a public deferral is removed first so the card never shows to the
 * channel; after an earlier reply the card is a private follow-up.
 */
export async function replyPrivately(
    interaction: PrivateReplyTarget,
    view: MessageView,
    options: MessageKitOptions = {}
) {
    const privateView = { ...view, ephemeral: true }
    if (interaction.deferred && !interaction.replied) {
        if (interaction.ephemeral) {
            await interaction.editReply(editPayload(privateView, options))
            return
        }
        // The first follow-up of a deferral replaces it and keeps its
        // visibility, so a public "thinking…" message goes away first.
        const payload = interactionReplyPayload(privateView, options)
        await interaction.deleteReply().catch(() => null)
        await interaction.followUp(payload)
        return
    }
    const payload = interactionReplyPayload(privateView, options)
    if (interaction.replied) await interaction.followUp(payload)
    else await interaction.reply(payload)
}

/**
 * What the errors channel needs to explain an admin-fixable failure: the
 * error and, preferably, its `source` ("ticketOpen", "playerReport", …)
 * with what it concerns. The older free-text `action`/`location`/`scope`
 * still work; they are only read to recognise the source.
 */
export type ErrorsChannelReport = Omit<
    ClanErrorReportInput,
    "client" | "guildId"
>

export type ErrorsChannelReporter = typeof reportClanDiscordError

/**
 * Posts an admin-fixable failure to the clan's errors channel (board L5:
 * grey card, what failed, "Proč" and "Co udělat"); a failed report is
 * logged and never breaks the reply to the person.
 */
export async function reportToErrorsChannel(
    input: { client?: Client; guildId: string | null } & ErrorsChannelReport,
    reporter: ErrorsChannelReporter = reportClanDiscordError
) {
    if (!input.guildId) return
    await reporter({ ...input, guildId: input.guildId }).catch((error) =>
        logWarn("ui", "Failed to report an admin-fixable error", {
            guildId: input.guildId,
            source: input.source ?? input.scope,
            error,
        })
    )
}

type ErrorTarget = PrivateReplyTarget & {
    client?: Client
    guildId: string | null
}

/**
 * Replies with an error card (`errorCard`, `notAllowedCard`,
 * `wrongPlaceCard`). With `report`, the cause also goes to the errors channel.
 */
export async function replyError(
    interaction: ErrorTarget,
    card: MessageView,
    options: MessageKitOptions & {
        report?: ErrorsChannelReport
        reporter?: ErrorsChannelReporter
    } = {}
) {
    await replyPrivately(interaction, card, options)
    if (options.report)
        await reportToErrorsChannel(
            {
                client: interaction.client,
                guildId: interaction.guildId,
                ...options.report,
            },
            options.reporter
        )
}

/**
 * An error only an admin can fix: the person gets the reason and "správci
 * dostali upozornění", the errors channel gets the details.
 */
export async function replyAdminFixableError(
    interaction: ErrorTarget,
    input: { title: string; report: ErrorsChannelReport },
    options: MessageKitOptions & { reporter?: ErrorsChannelReporter } = {}
) {
    const copy = getSystemMessages(options.language).errors
    await replyError(
        interaction,
        adminFixableErrorCard({
            title: input.title,
            adminNotified: copy.adminNotified,
        }),
        { ...options, report: input.report }
    )
}

/** "Tohle se nepovedlo" for any failed button or command (M3-08). */
export async function replyUnknownError(
    interaction: PrivateReplyTarget,
    options: MessageKitOptions = {}
) {
    const copy = getSystemMessages(options.language).errors
    await replyPrivately(
        interaction,
        unknownErrorCard({ title: copy.unknownTitle, body: copy.unknownBody }),
        options
    )
}

/**
 * The clan language for a reply: the cached value without a backend read,
 * else one bounded read so a late reply still meets Discord's deadline.
 * Outside a server (a DM button) there is no clan, so English is used.
 */
export async function interactionLanguage(
    guildId: string | null | undefined,
    timeoutMs = 1_000
) {
    if (!guildId) return undefined
    const cached = cachedClanLanguage(guildId)
    if (cached) return cached
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            clanLanguageForGuild(guildId),
            new Promise<undefined>((resolve) => {
                timer = setTimeout(() => resolve(undefined), timeoutMs)
            }),
        ])
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Edits a message the bot owns into this view in place (a panel, a reply
 * card), never posting a new one.
 */
export async function editManagedMessage(
    message: { edit(options: MessageEditOptions): Promise<unknown> },
    view: MessageView,
    options: MessageKitOptions = {}
) {
    await message.edit(editPayload(view, options))
}
