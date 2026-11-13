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

import {
    MessageFlags,
    type ChatInputCommandInteraction,
    type Client,
    type ThreadChannel,
} from "discord.js"
import { isMessageEnabled } from "../../../src/domain/discord-messages/notification-settings"

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
    MembershipEffects,
    type MembershipEffectPort,
    type MembershipOperation,
} from "../runtime/membership-effects"
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
import { confirmedDmRefusal } from "../runtime/durable-delivery"
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
    effects(operation: MembershipOperation): MembershipEffectPort
    thread(threadId: string): Promise<TicketThreadContext | null>
    close(input: {
        threadId: string
        closedByUserId: string
        closeReason?: string
    }): Promise<boolean | void>
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
    const closeResult = await ports.close({
        threadId: interaction.channelId,
        closedByUserId: interaction.user.id,
        closeReason: reason,
    })
    // A concurrent closer may have committed while authority was checked.
    // It must not duplicate the close card, DM, or archive operations.
    if (closeResult === false) {
        await replyError(
            interaction,
            ticketAlreadyClosedCard(copy, ticket.ticketNumber),
            options
        )
        return
    }
    const effects = ports.effects({
        expectedKeys: [
            "close-card",
            "rename",
            "lock",
            "archive",
            ...(isMessageEnabled(context.config, "ticketCloseDm")
                ? [`dm:${ticket.creatorId}`]
                : []),
        ],
        key: `ticket-close:${interaction.channelId}`,
        kind: "ticket-close",
        guildId: interaction.guildId,
        subjectId: interaction.channelId,
        actorId: interaction.user.id,
    })

    const result = await deliverTicketClose({
        context,
        channel,
        threadId: interaction.channelId,
        guildId: interaction.guildId,
        client: interaction.client,
        actorId: interaction.user.id,
        actorName: displayName(interaction),
        clan: await clanName(interaction),
        reason,
        closedAt,
        effects,
        settingsUrl: ports.settingsUrl,
        reporter: ports.reporter,
    })
    await replyPrivately(
        interaction,
        ticketClosedReplyView({
            copy,
            ticketNumber: ticket.ticketNumber,
            dmDelivered: result.dmDelivered,
            cardPosted: result.cardPosted,
            threadFailed: result.threadFailed,
        }),
        options
    )
    await Promise.all(result.reports)
    await effects.complete()
}

/** Shared by the command and restart recovery after the close transaction. */
export async function deliverTicketClose(input: {
    context: TicketThreadContext
    channel: ThreadChannel
    threadId: string
    guildId: string
    client: Client
    actorId: string
    actorName: string
    clan: string
    reason?: string
    closedAt: number
    effects: MembershipEffectPort
    settingsUrl(language: string): string | undefined
    reporter?: ErrorsChannelReporter
}) {
    const {
        context,
        channel,
        threadId,
        guildId,
        client,
        actorId,
        actorName,
        clan,
        reason,
        closedAt,
        effects,
    } = input
    const { ticket } = context
    const language = context.config.defaultLanguage
    const copy = getTicketMessages(language)
    const options = { language, style: context.config.messageStyle }

    const threadUrl = `https://discord.com/channels/${guildId}/${threadId}`
    const skipped = !isMessageEnabled(context.config, "ticketCloseDm") ? await effects.skip(`dm:${ticket.creatorId}`) : null
    // The "DM o uzavření ticketu" switch on the messages page (N1-42).
    const dmDelivered = !isMessageEnabled(context.config, "ticketCloseDm")
        ? (skipped?.state === "uncertain" ? "uncertain" as const : skipped?.state === "confirmed" ? true : skipped?.state === "refused" ? false : "off" as const)
        : await client.users
              .fetch(ticket.creatorId)
              .then(async (author) => {
                  const receipt = await effects.effect(
                      `dm:${ticket.creatorId}`,
                      "send",
                      async () =>
                          author.send(
                              messagePayload(
                                  ticketClosedDmView({
                                      copy,
                                      clanName: clan,
                                      ticketNumber: ticket.ticketNumber,
                                      category: ticket.categoryLabel,
                                      closerName: actorName,
                                      reason,
                                      threadUrl,
                                      settingsUrl: input.settingsUrl(language),
                                  }),
                                  options
                              )
                          ),
                      true
                  )
                  return receipt.state === "skipped" ? "off" as const : receipt.state === "confirmed"
              })
              // Closed DMs are reported to the closer, not to the errors channel (L2-63).
              .catch((error) => {
                  logWarn(
                      "membership-recovery",
                      "Ticket close DM remains unconfirmed",
                      { guildId, threadId, error }
                  )
                  return confirmedDmRefusal(error)
                      ? false
                      : ("uncertain" as const)
              })

    // What an admin can fix goes to the errors channel (W9), after the reply.
    const reports: Promise<void>[] = []
    const report = (source: BotErrorSource, error: unknown) =>
        reports.push(
            reportToErrorsChannel(
                {
                    client,
                    guildId,
                    error,
                    source,
                    channelId: ticket.parentChannelId,
                    categoryLabel: ticket.categoryLabel,
                    number: ticket.ticketNumber,
                    userId: actorId,
                },
                input.reporter
            )
        )

    const locale = getIntlLocaleForClanLanguage(language)
    const timeZone = context.config.timezone || "UTC"
    const cardPosted = await effects
        .effect("close-card", "send", () =>
            channel.send(
                messagePayload(
                    ticketClosedView({
                        copy,
                        ticketNumber: ticket.ticketNumber,
                        closerId: actorId,
                        closedAt,
                        reason,
                        locale,
                        timeZone,
                    }),
                    options
                )
            )
        )
        .then(() => true)
        .catch((error) => {
            logWarn("interaction", "Failed to post the ticket close card", {
                guildId,
                threadId,
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
            await effects.effect(
                name,
                "reconcile",
                async () => {
                    await run()
                },
                false,
                {
                    threadId,
                    action: name,
                    value:
                        name === "rename"
                            ? closedTicketThreadName(
                                  copy,
                                  ticket.categoryLabel,
                                  ticket.ticketNumber
                              )
                            : undefined,
                }
            )
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

    return { dmDelivered, cardPosted, threadFailed, reports }
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
    effects: (operation) => new MembershipEffects(operation),
    thread: async (threadId) =>
        (await convex.query(references.getTicketThreadContext, {
            secret: env.internalSecret,
            threadId,
        })) as TicketThreadContext | null,
    close: async (input) => {
        const result = (await convex.mutation(references.closeTicketThread, {
            secret: env.internalSecret,
            durableEffects: true,
            ...input,
        })) as { ok: boolean }
        return result.ok
    },
    settingsUrl: dmSettingsUrl,
}))
