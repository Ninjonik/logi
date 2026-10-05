/**
 * `/close_ticket` (boards M3 1.5 and L4 1.4): in a ticket thread, the
 * category's support or Logi's admins close the ticket after the same fresh
 * role check as `/close_application` (M3-04, M3-B05). The thread gets the
 * close card, the author a DM, the thread is renamed "uzavřeno · Nahlásit
 * hráče #12", locked and archived, and the private reply says whether the
 * DM arrived (M3-B06). Every refusal is the shared card in the clan
 * language, never English.
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
} from "../../../src/domain/discord-tickets/ticket-views"
import type {
    DiscordConfig,
    TicketCategory,
    TicketThreadRecord,
} from "../types"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { interactionLanguage, replyError, replyPrivately } from "../ui/replies"
import { getTicketMessages } from "../../../src/lib/clan-language/tickets"
import { dmSettingsUrl } from "../events/match-context"
import { checkCloseAuthority } from "./close-authority"
import type { InteractionFeature } from "./registry"
import { messagePayload } from "../ui/message-kit"
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
    /** The clan language when the thread is not a ticket. */
    language?(guildId: string | null): Promise<string | undefined>
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
    if (
        !interaction.inGuild() ||
        !interaction.guildId ||
        !channel?.isThread()
    ) {
        const language = await (ports.language ?? interactionLanguage)(
            interaction.guildId
        )
        await replyError(
            interaction,
            ticketCloseOutsideCard(getTicketMessages(language)),
            { language }
        )
        return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const context = await ports.thread(interaction.channelId)
    if (!context) {
        const language = await (ports.language ?? interactionLanguage)(
            interaction.guildId
        )
        await replyError(
            interaction,
            ticketCloseNotTicketCard(getTicketMessages(language)),
            { language }
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

    const locale = getIntlLocaleForClanLanguage(language)
    const timeZone = context.config.timezone || "UTC"
    await channel
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
        .catch((error) =>
            logWarn("interaction", "Failed to post the ticket close card", {
                guildId: interaction.guildId,
                threadId: interaction.channelId,
                error,
            })
        )
    const auditReason = reason ?? copy.closed.auditReason
    await channel
        .setName(
            closedTicketThreadName(
                copy,
                ticket.categoryLabel,
                ticket.ticketNumber
            ),
            auditReason
        )
        .catch(() => null)
    await channel.setLocked(true, auditReason).catch(() => null)
    await channel.setArchived(true, auditReason).catch(() => null)

    await replyPrivately(
        interaction,
        ticketClosedReplyView({
            copy,
            ticketNumber: ticket.ticketNumber,
            dmDelivered,
        }),
        options
    )
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
