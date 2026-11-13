import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags,
    type Interaction,
    type InteractionDeferReplyOptions,
    type InteractionEditReplyOptions,
    type InteractionReplyOptions,
    type InteractionUpdateOptions,
    type ModalBuilder,
    type ButtonInteraction,
    type Message,
} from "discord.js"
import { randomUUID } from "node:crypto"

import { getInteractionAcknowledgementMessages } from "../../../src/lib/clan-language/interaction-acknowledgement"
import { cachedClanLanguage } from "../runtime/clan-language"

export const CONTINUE_MODAL_PREFIX = "prepared-modal:"
const pendingForms = new Map<string, string>()
const modalCollectors = new Set<() => void>()
let modalsStopped = false

export function stopPreparedModals() {
    modalsStopped = true
    for (const stop of modalCollectors) stop()
    for (const origin of modalOrigins.values()) clearTimeout(origin.timeout)
    modalOrigins.clear()
    pendingForms.clear()
}

type ModalOrigin = {
    userId: string
    message: Message | null
    edit: (options: InteractionEditReplyOptions) => Promise<Message>
    timeout: ReturnType<typeof setTimeout>
}
const modalOrigins = new Map<string, ModalOrigin>()

/** Preserve the source card semantics when a prepared form uses a fresh click. */
function restoreModalOrigin<T extends Interaction>(source: T): T {
    if (!source.isModalSubmit() || !source.message) return source
    const origin = modalOrigins.get(source.message.id)
    if (!origin || origin.userId !== source.user.id) return source
    modalOrigins.delete(source.message.id)
    clearTimeout(origin.timeout)
    let updatingSource = false
    return new Proxy(source, {
        get(target, property) {
            if (property === "message") return origin.message
            if (property === "isFromMessage")
                return () => origin.message !== null
            if (property === "deferUpdate")
                return async () => {
                    updatingSource = true
                    return source.deferUpdate()
                }
            if (property === "update")
                return async (options: InteractionUpdateOptions) => {
                    updatingSource = true
                    await source.deferUpdate()
                    return origin.edit(options)
                }
            if (property === "editReply")
                return async (options: InteractionEditReplyOptions) => {
                    return updatingSource
                        ? origin.edit(options)
                        : source.editReply(options)
                }
            if (property === "deleteReply" && updatingSource)
                return async () => {}
            const value: unknown = Reflect.get(target, property, target)
            return typeof value === "function" ? value.bind(target) : value
        },
    })
}

export class PreparedModalExpired extends Error {}

/** Collectors own live form buttons; old buttons get an immediate private reply. */
export async function handlePreparedModalButton(
    interaction: ButtonInteraction
) {
    if (!interaction.customId.startsWith(CONTINUE_MODAL_PREFIX)) return false
    if (pendingForms.get(interaction.customId) !== interaction.user.id) {
        await interaction.reply({
            content: getInteractionAcknowledgementMessages(
                cachedClanLanguage(interaction.guildId ?? "")
            ).expired,
            flags: MessageFlags.Ephemeral,
        })
    }
    return true
}

// discord.js accepts numbers, named flags, nested arrays and BitField objects.
// Normalize structurally because its narrowed flag generics are invariant.
function flagBits(value: unknown): number {
    if (value === undefined) return 0
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const named = Object.entries(MessageFlags).find(
            ([key]) => key === value
        )?.[1]
        if (typeof named === "number") return named
        if (/^\d+$/.test(value)) return Number(value)
    }
    if (Array.isArray(value))
        return value.reduce<number>(
            (bits, item: unknown) => bits | flagBits(item),
            0
        )
    if (value && typeof value === "object" && "bitfield" in value)
        return flagBits(value.bitfield)
    throw new Error("Invalid Discord message flags")
}

/**
 * A deadline backstop for the gateway entry point. Fast handlers use the native
 * interaction unchanged. After a fallback ACK, this facade preserves the
 * handler's choice of a new reply versus an edit of the source message.
 * In particular, a private reply must never replace a public component message.
 */
export function protectInteraction<T extends Interaction>(
    received: T,
    delayMs = 1_000
): { interaction: T; finish: () => Promise<void> } {
    const source = restoreModalOrigin(received)
    let acknowledgement: Promise<unknown> | undefined
    let automatic = false
    let claimed = false
    let deferred = false
    let replied = false
    let ephemeral: boolean | null = null
    let replyId: string | undefined
    let sourceResponse = false
    let deleted = false

    const cancel = () => clearTimeout(timer)
    const copy = getInteractionAcknowledgementMessages(
        cachedClanLanguage(source.guildId ?? "")
    )
    const component =
        source.isMessageComponent() ||
        (source.isModalSubmit() && source.isFromMessage())

    if (!source.isRepliable() && !source.isAutocomplete())
        return { interaction: source, finish: async () => {} }

    const timer = setTimeout(() => {
        if (source.isRepliable() && (source.deferred || source.replied)) return
        if (source.isAutocomplete() && source.responded) return
        automatic = true
        acknowledgement = source.isAutocomplete()
            ? source.respond([])
            : source.isRepliable()
              ? component && "deferUpdate" in source
                  ? source.deferUpdate()
                  : source.deferReply({ flags: MessageFlags.Ephemeral })
              : Promise.resolve()
        // Keep timer failures handled; the handler or finish() observes them.
        void acknowledgement.catch(() => undefined)
    }, delayMs)
    timer.unref()

    const initial = async () => {
        cancel()
        await acknowledgement
        claimed = true
    }

    function privateReply(
        options: InteractionReplyOptions | InteractionDeferReplyOptions
    ) {
        return (
            Boolean(options.ephemeral) ||
            Boolean(flagBits(options.flags) & MessageFlags.Ephemeral)
        )
    }

    async function sendReply(options: InteractionReplyOptions) {
        if (!source.isRepliable())
            throw new Error("Interaction is not repliable")
        ephemeral = privateReply(options)
        // Components were deferred as updates, so a reply is a separate message.
        // Slash commands were deferred privately; public replies must be new.
        if (component || !ephemeral) {
            if (!component) await source.deleteReply()
            const message = await source.followUp(options)
            replyId = message.id
            return message
        }
        const { ephemeral: _ephemeral, flags: _flags, ...rest } = options
        const flags = flagBits(options.flags) & ~MessageFlags.Ephemeral
        return source.editReply({ ...rest, flags })
    }

    const interaction = new Proxy(source, {
        get(target, property) {
            if (automatic) {
                if (property === "deferred") return claimed && deferred
                if (property === "replied") return claimed && replied
                if (property === "ephemeral") return ephemeral
            }
            if (property === "respond" && source.isAutocomplete()) {
                return async (...args: Parameters<typeof source.respond>) => {
                    await initial()
                    if (!automatic) return source.respond(...args)
                }
            }
            if (source.isRepliable()) {
                if (property === "reply")
                    return async (options: InteractionReplyOptions) => {
                        await initial()
                        if (!automatic) return source.reply(options)
                        const result = await sendReply(options)
                        replied = true
                        return result
                    }
                if (property === "deferReply")
                    return async (
                        options: InteractionDeferReplyOptions = {}
                    ) => {
                        await initial()
                        if (!automatic) return source.deferReply(options)
                        ephemeral = privateReply(options)
                        if (component || !ephemeral) {
                            await sendReply({
                                content: copy.working,
                                flags: ephemeral
                                    ? MessageFlags.Ephemeral
                                    : undefined,
                            })
                        }
                        deferred = true
                    }
                if (property === "deferUpdate" && "deferUpdate" in source)
                    return async () => {
                        await initial()
                        if (!automatic) return source.deferUpdate()
                        sourceResponse = true
                        deferred = true
                        ephemeral =
                            "message" in source &&
                            Boolean(
                                source.message?.flags.has(
                                    MessageFlags.Ephemeral
                                )
                            )
                    }
                if (property === "update" && "update" in source)
                    return async (options: InteractionUpdateOptions) => {
                        await initial()
                        if (!automatic) return source.update(options)
                        sourceResponse = true
                        const result = await source.editReply(options)
                        replied = true
                        return result
                    }
                if (property === "editReply")
                    return async (options: InteractionEditReplyOptions) => {
                        await acknowledgement
                        if (!automatic) return source.editReply(options)
                        const result = replyId
                            ? await source.webhook.editMessage(replyId, options)
                            : await source.editReply(options)
                        replied = true
                        return result
                    }
                if (property === "followUp")
                    return async (options: InteractionReplyOptions) => {
                        await acknowledgement
                        if (
                            automatic &&
                            deferred &&
                            !replied &&
                            !sourceResponse &&
                            !deleted &&
                            replyId
                        ) {
                            const {
                                ephemeral: _ephemeral,
                                flags: _flags,
                                ...rest
                            } = options
                            const result = await source.webhook.editMessage(
                                replyId,
                                {
                                    ...rest,
                                    ...(flagBits(options.flags) &
                                    MessageFlags.IsComponentsV2
                                        ? { content: null, embeds: [] }
                                        : {}),
                                    flags:
                                        flagBits(options.flags) &
                                        ~MessageFlags.Ephemeral,
                                }
                            )
                            replied = true
                            return result
                        }
                        const result = await source.followUp(options)
                        if (automatic) replied = true
                        return result
                    }
                if (property === "deleteReply")
                    return async () => {
                        await acknowledgement
                        if (!automatic) return source.deleteReply()
                        deleted = true
                        // Error helpers may discard a public deferral before sending
                        // a private follow-up. Never delete the shared source card.
                        if (sourceResponse) return
                        if (replyId)
                            return source.webhook.deleteMessage(replyId)
                        return source.deleteReply()
                    }
                if (property === "showModal" && "showModal" in source)
                    return async (modal: ModalBuilder) => {
                        await initial()
                        if (modalsStopped) throw new PreparedModalExpired()
                        if (!automatic) return source.showModal(modal)
                        const customId = `${CONTINUE_MODAL_PREFIX}${randomUUID()}`
                        const message = await sendReply({
                            content: copy.ready,
                            flags: MessageFlags.Ephemeral,
                            components: [
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(customId)
                                        .setLabel(copy.open)
                                        .setStyle(ButtonStyle.Primary)
                                ),
                            ],
                        })
                        replied = true
                        if (modalsStopped) throw new PreparedModalExpired()
                        pendingForms.set(customId, source.user.id)
                        const collector =
                            message.createMessageComponentCollector({
                                max: 1,
                                componentType: ComponentType.Button,
                                time: 300_000,
                                filter: (candidate) => {
                                    if (
                                        candidate.customId !== customId ||
                                        candidate.user.id !== source.user.id ||
                                        !pendingForms.has(customId)
                                    )
                                        return false
                                    pendingForms.delete(customId)
                                    return true
                                },
                            })
                        const cancel = () => collector.stop("shutdown")
                        modalCollectors.add(cancel)
                        const click =
                            await new Promise<ButtonInteraction | null>(
                                (resolve) => {
                                    collector.once("collect", resolve)
                                    collector.once("end", () => resolve(null))
                                }
                            ).finally(() => modalCollectors.delete(cancel))
                        pendingForms.delete(customId)
                        if (!click) {
                            await source.webhook.editMessage(message.id, {
                                content: copy.expired,
                                components: [],
                            })
                            throw new PreparedModalExpired()
                        }
                        // The new button is only a transport step. Submission handlers
                        // must still see/edit the original card, not this prompt.
                        const timeout = setTimeout(
                            () => modalOrigins.delete(message.id),
                            300_000
                        )
                        timeout.unref()
                        modalOrigins.set(message.id, {
                            userId: source.user.id,
                            message: source.isMessageComponent()
                                ? source.message
                                : null,
                            edit: (options) => source.editReply(options),
                            timeout,
                        })
                        // Show the already-built form without any intervening I/O.
                        try {
                            await click.showModal(modal)
                        } catch (error) {
                            clearTimeout(timeout)
                            modalOrigins.delete(message.id)
                            throw error
                        }
                        void source.webhook
                            .editMessage(message.id, { components: [] })
                            .catch(() => undefined)
                    }
            }
            const value: unknown = Reflect.get(target, property, target)
            return typeof value === "function" ? value.bind(target) : value
        },
    })
    return {
        interaction,
        finish: async () => {
            cancel()
            await acknowledgement
        },
    }
}
