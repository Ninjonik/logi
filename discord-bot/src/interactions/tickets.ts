/**
 * Support tickets (board L4 1.4): the category button or select on the
 * ticket panel, the category's window and the private thread with its
 * opening card. Every reply is a private card in the clan language; a
 * failure only an admin can fix goes to the errors channel and the person
 * reads "Nic se neuložilo. Správci dostali upozornění…" (L4-40, L4-B06).
 * The opening card pings only the author and the category's support roles
 * (L4-B05); the thread is named "Nahlásit hráče #12" (L4-45).
 */

import {
    ChannelType,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type Guild,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
    type TextChannel,
    type ThreadChannel,
} from "discord.js"

import {
    TICKET_BUTTON_PREFIX,
    TICKET_MODAL_PREFIX,
    TICKET_SELECT_ID,
    ticketCategoryGoneCard,
    ticketCategoryLabel,
    ticketFailedCard,
    ticketIntroMentions,
    ticketIntroView,
    ticketOpenedView,
    ticketsDisabledCard,
    ticketThreadName,
    type TicketAnswer,
} from "../../../src/domain/discord-tickets/ticket-views"
import {
    replyError,
    replyPrivately,
    reportToErrorsChannel,
    type ErrorsChannelReport,
    type ErrorsChannelReporter,
} from "../ui/replies"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { getTicketMessages } from "../../../src/lib/clan-language/tickets"
import { cleanupThread, resolveSupportMemberIds } from "./shared"
import type { DiscordConfig, TicketCategory } from "../types"
import type { InteractionFeature } from "./registry"
import { messagePayload } from "../ui/message-kit"
import { convex, references } from "../convex"
import { logError, logWarn } from "../log"
import { env } from "../environment"

/** A stored ticket as `discordMembership:createTicketThread` returns it. */
export type CreatedTicket = {
    ticket: { ticketNumber: number; categoryLabel: string; threadId: string }
}

/** What tickets read and write; Convex in production, fakes in tests. */
export type TicketPorts = {
    /** The clan's Discord configuration (language, ticket settings, style). */
    config(guildId: string): Promise<DiscordConfig | null>
    /** Stores the ticket and gives it the next number. */
    createRecord(input: {
        guildId: string
        threadId: string
        parentChannelId: string
        creatorId: string
        categoryId: string
        answers: Array<TicketAnswer & { questionId: string }>
    }): Promise<CreatedTicket>
    /** Remembers the opening card as the ticket's transcript start. */
    storeIntroMessage(threadId: string, messageId: string): Promise<void>
    reporter?: ErrorsChannelReporter
    now?: () => number
}

const LOCATION = "Ticket system"

function categoryOf(config: DiscordConfig | null, categoryId: string) {
    return config?.ticketSettings?.categories.find(
        (category) => category.id === categoryId
    )
}

function kitOptions(config: DiscordConfig | null) {
    return {
        language: config?.defaultLanguage,
        style: config?.messageStyle,
    }
}

/**
 * The category's window (L4-38): the category's name as the title and its
 * questions with their placeholders, required ones marked by Discord.
 */
export function buildTicketModal(
    category: TicketCategory,
    language: string | undefined
) {
    const copy = getTicketMessages(language)
    const title =
        ticketCategoryLabel(category).slice(0, 45) || copy.form.fallbackTitle
    const modal = new ModalBuilder()
        .setCustomId(`${TICKET_MODAL_PREFIX}${category.id}`)
        .setTitle(title)
    for (const question of category.modalQuestions.slice(0, 5)) {
        const input = new TextInputBuilder()
            .setCustomId(question.id)
            .setStyle(
                question.style === "paragraph"
                    ? TextInputStyle.Paragraph
                    : TextInputStyle.Short
            )
            .setRequired(question.required)
            .setMaxLength(question.style === "paragraph" ? 1000 : 400)
        if (question.placeholder?.trim())
            input.setPlaceholder(question.placeholder.trim().slice(0, 100))
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel(question.label.trim().slice(0, 45) || "?")
                .setTextInputComponent(input)
        )
    }
    return modal
}

type OpenInteraction =
    ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction

/** Opens the category's window, or the ticket at once without questions. */
async function openCategory(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    categoryId: string,
    ports: TicketPorts
) {
    const config = interaction.guildId
        ? await ports.config(interaction.guildId)
        : null
    const copy = getTicketMessages(config?.defaultLanguage)
    const options = kitOptions(config)
    if (!config?.ticketSettings?.enabled) {
        await replyError(interaction, ticketsDisabledCard(copy), options)
        return
    }
    const category = categoryOf(config, categoryId)
    if (!category) {
        await replyError(interaction, ticketCategoryGoneCard(copy), options)
        return
    }
    if (category.modalQuestions.length) {
        await interaction.showModal(
            buildTicketModal(category, config.defaultLanguage)
        )
        return
    }
    await createTicket(interaction, config, category, [], ports)
}

/** The panel's category button `ticket:<categoryId>` (L4-37). */
export async function handleTicketButton(
    interaction: ButtonInteraction,
    ports: TicketPorts
) {
    await openCategory(
        interaction,
        interaction.customId.slice(TICKET_BUTTON_PREFIX.length),
        ports
    )
}

/** The category select of a panel with more than ten categories. */
export async function handleTicketSelect(
    interaction: StringSelectMenuInteraction,
    ports: TicketPorts
) {
    await openCategory(interaction, interaction.values[0] ?? "", ports)
}

/** The submitted window: the answers open the ticket. */
export async function handleTicketModal(
    interaction: ModalSubmitInteraction,
    ports: TicketPorts
) {
    const config = interaction.guildId
        ? await ports.config(interaction.guildId)
        : null
    const copy = getTicketMessages(config?.defaultLanguage)
    const options = kitOptions(config)
    if (!config?.ticketSettings?.enabled) {
        await replyError(interaction, ticketsDisabledCard(copy), options)
        return
    }
    const category = categoryOf(
        config,
        interaction.customId.slice(TICKET_MODAL_PREFIX.length)
    )
    if (!category) {
        await replyError(interaction, ticketCategoryGoneCard(copy), options)
        return
    }
    const answers = category.modalQuestions.slice(0, 5).map((question) => {
        let value = ""
        try {
            value = interaction.fields.getTextInputValue(question.id).trim()
        } catch {
            // An optional question left empty.
        }
        return { questionId: question.id, label: question.label, value }
    })
    await createTicket(interaction, config, category, answers, ports)
}

/**
 * Creates the ticket: a private thread under the ticket channel, its
 * members, the stored record with the next number, the opening card and
 * the final name. The person gets "Ticket #12 je otevřený" with the thread,
 * or the one failure card while the errors channel gets the cause.
 */
export async function createTicket(
    interaction: OpenInteraction,
    config: DiscordConfig,
    category: TicketCategory,
    answers: Array<TicketAnswer & { questionId: string }>,
    ports: TicketPorts
) {
    const guild = interaction.guild
    const guildId = interaction.guildId
    const copy = getTicketMessages(config.defaultLanguage)
    const options = kitOptions(config)
    const label = ticketCategoryLabel(category)
    if (!interaction.deferred && !interaction.replied)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const fail = (report: Omit<ErrorsChannelReport, "location" | "scope">) =>
        replyError(interaction, ticketFailedCard(copy), {
            ...options,
            reporter: ports.reporter,
            report: {
                ...report,
                location: LOCATION,
                scope: "interaction",
                target: label,
            },
        })

    const parentId = config.ticketSettings?.ticketParentChannelId
    const parent =
        guild && parentId
            ? await guild.channels.fetch(parentId).catch(() => null)
            : null
    if (
        !guild ||
        !guildId ||
        !parent ||
        parent.type !== ChannelType.GuildText
    ) {
        await fail({
            error: new Error(
                "The ticket channel is missing or is not a text channel."
            ),
            action: "Open a ticket",
            details: { channelId: parentId },
        })
        return
    }

    let thread: ThreadChannel
    try {
        thread = await (parent as TextChannel).threads.create({
            name: label.slice(0, 100),
            autoArchiveDuration: 10080,
            type: ChannelType.PrivateThread,
            invitable: false,
            reason: `Ticket ${category.id} opened by ${interaction.user.tag}`,
        })
    } catch (error) {
        logError("interaction", "Failed to create ticket thread", {
            guildId,
            userId: interaction.user.id,
            categoryId: category.id,
            error,
        })
        await fail({ error, action: "Create a ticket thread" })
        return
    }

    await addTicketMembers(guild, thread, interaction.user.id, category, ports)

    let created: CreatedTicket
    try {
        created = await ports.createRecord({
            guildId,
            threadId: thread.id,
            parentChannelId: parent.id,
            creatorId: interaction.user.id,
            categoryId: category.id,
            answers,
        })
    } catch (error) {
        logError("interaction", "Failed to create ticket thread record", {
            guildId,
            threadId: thread.id,
            error,
        })
        await cleanupThread(thread, "Ticket record creation failed")
        await fail({ error, action: "Store a new ticket" })
        return
    }

    const number = created.ticket.ticketNumber
    const categoryLabel = created.ticket.categoryLabel || label
    const mentions = ticketIntroMentions({
        authorId: interaction.user.id,
        supportRoleIds: category.supportRoleIds,
    })
    const intro = messagePayload(
        ticketIntroView({
            copy,
            ticketNumber: number,
            category: categoryLabel,
            titleTemplate: category.threadTitle,
            authorName:
                (interaction.member &&
                "displayName" in interaction.member &&
                typeof interaction.member.displayName === "string"
                    ? interaction.member.displayName
                    : undefined) ??
                interaction.user.globalName ??
                interaction.user.username,
            openedAt: (ports.now ?? Date.now)(),
            answers,
            locale: getIntlLocaleForClanLanguage(config.defaultLanguage),
            timeZone: config.timezone || "UTC",
        }),
        options
    )
    const starter = await thread
        .send({
            ...intro,
            components: [
                new TextDisplayBuilder().setContent(mentions.content),
                ...intro.components,
            ],
            allowedMentions: mentions.allowedMentions,
        })
        .catch(async (error) => {
            logError("interaction", "Failed to send ticket starter message", {
                guildId,
                threadId: thread.id,
                error,
            })
            await reportToErrorsChannel(
                {
                    client: interaction.client,
                    guildId,
                    error,
                    action: "Send the first ticket message",
                    location: LOCATION,
                    scope: "interaction",
                    target: thread.name,
                    details: { threadId: thread.id },
                },
                ports.reporter
            )
            return null
        })
    if (starter)
        await ports.storeIntroMessage(thread.id, starter.id).catch((error) =>
            logWarn("interaction", "Failed to store ticket intro message id", {
                guildId,
                threadId: thread.id,
                error,
            })
        )

    await thread
        .setName(ticketThreadName(copy, categoryLabel, number))
        .catch(async (error) => {
            logWarn("interaction", "Failed to rename ticket thread", {
                guildId,
                threadId: thread.id,
                error,
            })
            await reportToErrorsChannel(
                {
                    client: interaction.client,
                    guildId,
                    error,
                    action: "Rename a ticket thread",
                    location: LOCATION,
                    scope: "interaction",
                    target: thread.name,
                    details: { threadId: thread.id },
                },
                ports.reporter
            )
        })

    await replyPrivately(
        interaction,
        ticketOpenedView({
            copy,
            ticketNumber: number,
            threadId: thread.id,
            threadUrl: `https://discord.com/channels/${guildId}/${thread.id}`,
        }),
        options
    )
}

/**
 * Adds the author and the category's support members to the private
 * thread. A member Discord refuses is reported, never shown to the author.
 */
async function addTicketMembers(
    guild: Guild,
    thread: ThreadChannel,
    authorId: string,
    category: TicketCategory,
    ports: TicketPorts
) {
    await guild.members.fetch().catch(() => null)
    const memberIds = [
        ...new Set([
            authorId,
            ...resolveSupportMemberIds(guild, category.supportRoleIds),
        ]),
    ]
    for (const memberId of memberIds)
        await thread.members.add(memberId).catch(async (error) => {
            logWarn("interaction", "Failed to add ticket thread member", {
                guildId: guild.id,
                threadId: thread.id,
                memberId,
                error,
            })
            await reportToErrorsChannel(
                {
                    client: thread.client,
                    guildId: guild.id,
                    error,
                    action: "Add a participant to a ticket thread",
                    location: LOCATION,
                    scope: "interaction",
                    target: thread.name,
                    details: { threadId: thread.id, memberId },
                },
                ports.reporter
            )
        })
}

/** Routes the panel's buttons and select and the category window. */
export function ticketInteractions(
    ports: () => TicketPorts
): InteractionFeature {
    return {
        name: "tickets",
        register(registry) {
            registry
                .button(TICKET_BUTTON_PREFIX, (interaction) =>
                    handleTicketButton(interaction, ports())
                )
                .stringSelect(TICKET_SELECT_ID, (interaction) =>
                    handleTicketSelect(interaction, ports())
                )
                .modal(TICKET_MODAL_PREFIX, (interaction) =>
                    handleTicketModal(interaction, ports())
                )
        },
    }
}

/** Tickets wired to Convex. */
export const ticketsFeature = ticketInteractions(() => ({
    config: async (guildId) =>
        (await convex.query(references.getConfigByDiscordGuildId, {
            secret: env.internalSecret,
            guildId,
        })) as DiscordConfig | null,
    createRecord: async (input) =>
        (await convex.mutation(references.createTicketThread, {
            secret: env.internalSecret,
            ...input,
        })) as CreatedTicket,
    storeIntroMessage: async (threadId, messageId) => {
        await convex.mutation(references.updateTicketTranscriptMessage, {
            secret: env.internalSecret,
            threadId,
            transcriptMessageId: messageId,
        })
    },
}))
