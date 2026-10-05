import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    type ModalSubmitInteraction,
} from "discord.js"

import {
    noticeModalTitle,
    noticeMultipleCard,
    noticeNotSignedUpCard,
    noticeOptionLabel,
    noticeSavedView,
    noticeStartedCard,
    type NoticeEvent,
} from "../../../src/domain/discord-commands/notice-view"
import type {
    InteractionFeature,
    InteractionFeatureContext,
} from "../interactions/registry"
import { COMMAND_REASON_MAX_LENGTH } from "../../../src/domain/discord-commands/catalog"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { getCommandMessages } from "../../../src/lib/clan-language/commands"
import { checkCommandAccess, type AccessInteraction } from "./access"
import type { GuildCommandConfigs } from "./guild-configs"
import { replyError, replyPrivately } from "../ui/replies"
import { fallbackGuildLanguage } from "./definitions"

export const NOTICE_MODAL_PREFIX = "notice-modal:"
const EVENT_ID = /^[A-Za-z0-9_-]{1,64}$/

/** An eligible event as `events:findNoticeTarget` returns it. */
export type NoticeTarget = NoticeEvent & { id: string }

/** The event behind a notice, from `discordSync:getEventInteractionContext`. */
export type NoticeEventContext = {
    guildId: string
    language: string
    timeZone: string
    name: string
    gameStart?: string | null
    status?: string | null
    style?: { accentColor?: string; iconDensity?: "sparse" | "rich" } | null
    announcementsChannelId?: string | null
}

/** What `/notice` reads and writes; Convex in production, fakes in tests. */
export type NoticePorts = {
    configs: Pick<GuildCommandConfigs, "get">
    /** The person's signed-up events that have not started, matching `query`. */
    targets(
        guildId: string,
        userId: string,
        query: string
    ): Promise<NoticeTarget[]>
    event(eventId: string): Promise<NoticeEventContext | null>
    /** Saves the notice; throws the domain rule's error when refused. */
    save(eventId: string, userId: string, reason: string): Promise<void>
    /** After a save: refresh the web and the match's Discord messages. */
    saved(guildId: string, eventId: string): Promise<void>
    /**
     * After the confirmation: the optional "přijde později" post in the
     * match thread, without the reason (board L5-43, N1-15). It checks the
     * clan's switch itself and never throws.
     */
    announce?(eventId: string, userId: string): Promise<void>
    now?: () => number
}

/**
 * The "Přijdu později" window (M3-16, also L2-30): "Přijdu později · VLK vs
 * ROG", the note that only the match leads see it, and "Kdy dorazíš a
 * proč?". The same window opens from `/notice` and from the reminder button.
 */
export function buildNoticeModal(input: {
    eventId: string
    eventName?: string | null
    language: string
}) {
    const copy = getCommandMessages(input.language).notice
    return new ModalBuilder()
        .setCustomId(`${NOTICE_MODAL_PREFIX}${input.eventId}`)
        .setTitle(noticeModalTitle(copy, input.eventName))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(copy.modalNote)
        )
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(copy.reasonLabel.slice(0, 45))
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId("reason")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(COMMAND_REASON_MAX_LENGTH)
                        .setPlaceholder(copy.reasonPlaceholder.slice(0, 100))
                )
        )
}

/**
 * The "akce" autocomplete (M1-B10, M3-15): only the person's signed-up
 * events that have not started, as "VLK vs ROG · Přátelák · ne 11. 10. ·
 * 20:00" in the clan's language and time zone.
 */
export async function handleNoticeAutocomplete(
    interaction: Pick<
        AutocompleteInteraction,
        "guildId" | "respond" | "options" | "user"
    >,
    ports: NoticePorts
) {
    const focused = interaction.options.getFocused(true)
    if (!interaction.guildId || focused.name !== "event") {
        await interaction.respond([])
        return
    }
    const config = await ports.configs.get(interaction.guildId)
    const locale = getIntlLocaleForClanLanguage(config?.language)
    const targets = await ports
        .targets(
            interaction.guildId,
            interaction.user.id,
            String(focused.value ?? "")
        )
        .catch(() => [])
    await interaction.respond(
        targets.slice(0, 25).map((target) => ({
            name: noticeOptionLabel(target, locale, config?.timeZone),
            value: target.id,
        }))
    )
}

type CommandInteraction = AccessInteraction &
    Pick<ChatInputCommandInteraction, "showModal"> & {
        options: { getString(name: string, required: true): string }
    }

/**
 * `/notice` (M3 1.3): picks the event from the typed text and opens the
 * "Přijdu později" window; not signed up, several matches and refusals are
 * the shared private cards.
 */
export async function handleNoticeCommand(
    interaction: CommandInteraction,
    ports: NoticePorts
) {
    // The window must be the first answer, so the check cannot defer; the
    // group is fixed to everyone, which needs no Discord read.
    const access = await checkCommandAccess(interaction, "notice", ports)
    if (!access || !interaction.guildId) return
    const copy = getCommandMessages(access.language).notice
    const options = {
        language: access.language,
        style: access.config?.messageStyle,
    }
    const selection = interaction.options.getString("event", true).trim()
    const targets = await ports.targets(
        interaction.guildId,
        interaction.user.id,
        selection
    )
    const exact =
        targets.find((target) => target.id === selection) ??
        (() => {
            const named = targets.filter(
                (target) =>
                    target.name.trim().toLowerCase() === selection.toLowerCase()
            )
            return named.length === 1 ? named[0] : undefined
        })() ??
        (targets.length === 1 ? targets[0] : undefined)
    if (exact) {
        await interaction.showModal(
            buildNoticeModal({
                eventId: exact.id,
                eventName: exact.name,
                language: access.language,
            })
        )
        return
    }
    await replyError(
        interaction,
        targets.length
            ? noticeMultipleCard(copy)
            : noticeNotSignedUpCard(
                  copy,
                  access.config?.announcementsChannelId
              ),
        options
    )
}

type ModalInteraction = Pick<
    ModalSubmitInteraction,
    "customId" | "deferReply" | "guildId"
> &
    AccessInteraction & {
        fields: { getTextInputValue(customId: string): string }
    }

const STARTED = /before game start|already concluded/i
const NOT_SIGNED_UP = /only attending players/i

/**
 * Saves the notice (M3-17, M3-B03): only for the person's signed-up event
 * that has not started; a later notice replaces the earlier one and
 * attendance reminders for that match stop. The private confirmation quotes
 * the reason; a started event or a missing sign-up get their own card.
 */
export async function handleNoticeModalSubmit(
    interaction: ModalInteraction,
    ports: NoticePorts
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const eventId = interaction.customId.slice(NOTICE_MODAL_PREFIX.length)
    const event = EVENT_ID.test(eventId)
        ? await ports.event(eventId).catch(() => null)
        : null
    const guildId = interaction.guildId ?? event?.guildId ?? null
    const config = guildId ? await ports.configs.get(guildId) : null
    const language =
        event?.language ??
        config?.language ??
        fallbackGuildLanguage(interaction.guild?.preferredLocale)
    const copy = getCommandMessages(language).notice
    const options = {
        language,
        style: event?.style ?? config?.messageStyle,
    }
    const notSignedUp = () =>
        replyError(
            interaction,
            noticeNotSignedUpCard(
                copy,
                event?.announcementsChannelId ?? config?.announcementsChannelId
            ),
            options
        )
    if (!event || !guildId) {
        await notSignedUp()
        return
    }
    const now = (ports.now ?? Date.now)()
    const started =
        event.status === "concluded" ||
        (event.gameStart ? Date.parse(event.gameStart) <= now : false)
    const target = (
        await ports.targets(guildId, interaction.user.id, eventId)
    ).find((candidate) => candidate.id === eventId)
    if (!target) {
        await (started
            ? replyError(
                  interaction,
                  noticeStartedCard(copy, event.name),
                  options
              )
            : notSignedUp())
        return
    }
    const reason = interaction.fields
        .getTextInputValue("reason")
        .slice(0, COMMAND_REASON_MAX_LENGTH)
    try {
        await ports.save(eventId, interaction.user.id, reason)
    } catch (error) {
        const message = error instanceof Error ? error.message : ""
        if (STARTED.test(message)) {
            await replyError(
                interaction,
                noticeStartedCard(copy, event.name),
                options
            )
            return
        }
        if (NOT_SIGNED_UP.test(message)) {
            await notSignedUp()
            return
        }
        throw error
    }
    await ports.saved(guildId, eventId)
    await replyPrivately(
        interaction,
        noticeSavedView({
            copy,
            event: {
                name: target.name,
                categoryLabel: target.categoryLabel,
                gameStart: target.gameStart ?? event.gameStart,
            },
            reason,
            locale: getIntlLocaleForClanLanguage(language),
            timeZone: event.timeZone,
        }),
        options
    )
    await ports.announce?.(eventId, interaction.user.id).catch(() => undefined)
}

/** Routes `/notice`, its autocomplete, the window and the reminder button. */
export function noticeInteractions(
    ports: (context: InteractionFeatureContext) => NoticePorts
): InteractionFeature {
    return {
        name: "notice",
        register(registry, context) {
            const current = () => ports(context)
            registry
                .command("notice", (interaction) =>
                    handleNoticeCommand(interaction, current())
                )
                .autocomplete("notice", (interaction) =>
                    handleNoticeAutocomplete(interaction, current())
                )
                .modal(NOTICE_MODAL_PREFIX, (interaction) =>
                    handleNoticeModalSubmit(interaction, current())
                )
        },
    }
}
