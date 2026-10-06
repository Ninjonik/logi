/**
 * `/close_ticket` (boards M3 1.5 and L4 1.4): in a ticket thread, the
 * category's support or Logi's admins close the ticket after the same fresh
 * role check as `/close_application` (M3-04, M3-B05). The thread gets the
 * close card, the author a DM, the thread is renamed "uzavřeno · Nahlásit
 * hráče #12", locked and archived, and the private reply says whether the
 * DM arrived (M3-B06). A close card, rename, lock or archive Discord refused
 * goes to the errors channel and the reply says what did not happen (M3-07,
 * M3-B02). Every refusal is the shared card in the clan language and
 * colour, never English (M3-06).
 */

import { isMessageEnabled } from "../../../src/domain/discord-messages/notification-settings"
import { MessageFlags, type ChatInputCommandInteraction } from "discord.js"

import {
    closedTicketThreadName,
    ticketAlreadyClosedCard,
    ticketClosedDmView,
    ticketClosedReplyView,
    ticketClosedView,
    ticketCloseNotAllowedCard,
    ticketCloseNotTicketCard,
    ticketCloseOutsideCard,
    ticketCloseUnverifiableCard,
    type TicketThreadStep,
} from "../../../src/domain/discord-tickets/ticket-views"
import {
    replyError,
    replyPrivately,
    reportToErrorsChannel,
    type ErrorsChannelReporter,
} from "../ui/replies"
import type {
    DiscordConfig,
    TicketCategory,
    TicketThreadRecord,
} from "../types"
import type { BotErrorSource } from "../../../src/domain/discord-messages/bot-errors"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { getTicketMessages } from "../../../src/lib/clan-language/tickets"
import { messagePayload, type MessageKitOptions } from "../ui/message-kit"
import { dmSettingsUrl } from "../events/match-context"
import { checkCloseAuthority } from "./close-authority"
import type { InteractionFeature } from "./registry"
import { clanReplyKit } from "../runtime/clan-kit"
import { convex, references } from "../convex"
import { env } from "../environment"
import { logWarn } from "../log"

/** A ticket thread as `discordMembership:getTicketThreadContext` returns it. */
export type TicketThreadContext = {
    config: DiscordConfig
    ticket: TicketThreadRecord
    category: TicketCategory | null
}

/** What `/close_ticket` reads and writes; Convex in production, fakes in tests. */
export type CloseTicketPorts = {
    thread(threadId: string): Promise<TicketThreadContext | null>
    close(input: {
        threadId: string
        closedByUserId: string
        closeReason?: string
    }): Promise<void>
    /** The account page a DM's footer opens ("Nastavit zprávy"). */
    settingsUrl(language: string): string | undefined
    /**
     * The clan language and colour when the thread is not a ticket (M3-06);
     * the live command settings by default.
     */
    kit?(guildId: string | null): Promise<MessageKitOptions>
    /** The errors channel (W9); the clan's errors channel by default. */
    reporter?: ErrorsChannelReporter
    now?: () => number
}

function displayName(interaction: ChatInputCommandInteraction) {
    const member = interaction.member
    return member && "displayName" in member && member.displayName.trim()
        ? member.displayName
        : interaction.user.globalName || interaction.user.username
}

async function clanName(interaction: ChatInputCommandInteraction) {
    if (interaction.guild?.name) return interaction.guild.name
    if (!interaction.guildId) return ""
    try {
        return (await interaction.client.guilds.fetch(interaction.guildId)).name
    } catch {
        return ""
    }
}

/** `/close_ticket [důvod]`. */
export async function handleCloseTicketCommand(
    interaction: ChatInputCommandInteraction,
    ports: CloseTicketPorts
) {
    const channel = interaction.channel
    const earlyKit = () => (ports.kit ?? clanReplyKit)(interaction.guildId)
    if (
        !interaction.inGuild() ||
        !interaction.guildId ||
        !channel?.isThread()
    ) {
        const kit = await earlyKit()
        await replyError(
            interaction,
            ticketCloseOutsideCard(getTicketMessages(kit.language)),
            kit
        )
        return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const context = await ports.thread(interaction.channelId)
    if (!context) {
        const kit = await earlyKit()
        await replyError(
            interaction,
            ticketCloseNotTicketCard(getTicketMessages(kit.language)),
            kit
        )
        return
    }

    const language = context.config.defaultLanguage
    const copy = getTicketMessages(language)
    const options = { language, style: context.config.messageStyle }
    const { ticket } = context
    if (ticket.status === "closed") {
        await replyError(
            interaction,
            ticketAlreadyClosedCard(copy, ticket.ticketNumber),
            options
        )
        return
    }

    // The same fresh check as /close_application (M3-04).
    const authority = await checkCloseAuthority(
        interaction.guild,
        interaction.user.id,
        {
            dashboardAdminRoleId: context.config.dashboardAdminRoleId,
            supportRoleIds: context.category?.supportRoleIds,
        }
    )
    if (authority !== "allowed") {
        await replyError(
            interaction,
            authority === "denied"
                ? ticketCloseNotAllowedCard({
                      copy,
                      category: ticket.categoryLabel,
                      supportRoleIds: context.category?.supportRoleIds ?? [],
                  })
                : ticketCloseUnverifiableCard(copy),
            options
        )
        return
    }

    const reason = interaction.options.getString("reason")?.trim() || undefined
    const closedAt = (ports.now ?? Date.now)()
    await ports.close({
        threadId: interaction.channelId,
        closedByUserId: interaction.user.id,
        closeReason: reason,
    })

    const threadUrl = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}`
    // The "DM o uzavření ticketu" switch on the messages page (N1-42).
    const dmDelivered = !isMessageEnabled(context.config, "ticketCloseDm")
        ? ("off" as const)
        : await interaction.client.users
              .fetch(ticket.creatorId)
              .then(async (author) => {
                  await author.send(
                      messagePayload(
                          ticketClosedDmView({
                              copy,
                              clanName: await clanName(interaction),
                              ticketNumber: ticket.ticketNumber,
                              category: ticket.categoryLabel,
                              closerName: displayName(interaction),
                              reason,
                              threadUrl,
                              settingsUrl: ports.settingsUrl(language),
                          }),
                          options
                      )
                  )
                  return true
              })
              // Closed DMs are reported to the closer, not to the errors channel (L2-63).
              .catch(() => false)

    // What an admin can fix goes to the errors channel (W9), after the reply.
    const reports: Promise<void>[] = []
    const report = (source: BotErrorSource, error: unknown) =>
        reports.push(
            reportToErrorsChannel(
                {
                    client: interaction.client,
                    guildId: interaction.guildId,
                    error,
                    source,
                    channelId: ticket.parentChannelId,
                    categoryLabel: ticket.categoryLabel,
                    number: ticket.ticketNumber,
                    userId: interaction.user.id,
                },
                ports.reporter
            )
        )

    const locale = getIntlLocaleForClanLanguage(language)
    const timeZone = context.config.timezone || "UTC"
    const cardPosted = await channel
        .send(
            messagePayload(
                ticketClosedView({
                    copy,
                    ticketNumber: ticket.ticketNumber,
                    closerId: interaction.user.id,
                    closedAt,
                    reason,
                    locale,
                    timeZone,
                }),
                options
            )
        )
        .then(() => true)
        .catch((error) => {
            logWarn("interaction", "Failed to post the ticket close card", {
                guildId: interaction.guildId,
                threadId: interaction.channelId,
                error,
            })
            report("ticketCloseCard", error)
            return false
        })
    const auditReason = reason ?? copy.closed.auditReason
    const threadFailed: TicketThreadStep[] = []
    let threadError: unknown
    const step = async (
        name: TicketThreadStep,
        run: () => Promise<unknown>
    ) => {
        try {
            await run()
        } catch (error) {
            threadFailed.push(name)
            threadError ??= error
        }
    }
    await step("rename", () =>
        channel.setName(
            closedTicketThreadName(
                copy,
                ticket.categoryLabel,
                ticket.ticketNumber
            ),
            auditReason
        )
    )
    await step("lock", () => channel.setLocked(true, auditReason))
    await step("archive", () => channel.setArchived(true, auditReason))
    // One entry for the thread: the steps share the permission they need.
    if (threadFailed.length) report("ticketCloseThread", threadError)

    await replyPrivately(
        interaction,
        ticketClosedReplyView({
            copy,
            ticketNumber: ticket.ticketNumber,
            dmDelivered,
            cardPosted,
            threadFailed,
        }),
        options
    )
    await Promise.all(reports)
}

/** Routes `/close_ticket`. */
export function closeTicketInteractions(
    ports: () => CloseTicketPorts
): InteractionFeature {
    return {
        name: "close-ticket",
        register(registry) {
            registry.command("close_ticket", (interaction) =>
                handleCloseTicketCommand(interaction, ports())
            )
        },
    }
}

/** `/close_ticket` wired to Convex. */
export const closeTicketFeature = closeTicketInteractions(() => ({
    thread: async (threadId) =>
        (await convex.query(references.getTicketThreadContext, {
            secret: env.internalSecret,
            threadId,
        })) as TicketThreadContext | null,
    close: async (input) => {
        await convex.mutation(references.closeTicketThread, {
            secret: env.internalSecret,
            ...input,
        })
    },
    settingsUrl: dmSettingsUrl,
}))
