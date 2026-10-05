/**
 * The bot's single message kit: turns a framework-free {@link MessageView}
 * (`src/domain/discord-messages/message-view.ts`) into discord.js Components
 * V2 builders and payloads. Every redesigned bot message goes through here,
 * so all of them share the container with the accent bar, the header, the
 * chips, the footer and the button rules. Never hand-roll a container.
 */

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    type InteractionEditReplyOptions,
    type InteractionReplyOptions,
    type MessageCreateOptions,
    type MessageEditOptions,
} from "discord.js"

import {
    layoutMessageView,
    type LayoutNode,
    type MessageLayout,
    type MessageLayoutOptions,
} from "../../../src/domain/discord-messages/message-layout"
import type {
    ChipTone,
    MessageButton,
    MessageSelect,
    MessageView,
} from "../../../src/domain/discord-messages/message-view"
import { assertValidMessageView } from "../../../src/domain/discord-messages/message-validation"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { getSystemMessages } from "../../../src/lib/clan-language/system"

/** How a view is rendered for one clan. */
export type MessageKitOptions = {
    /** The clan language (cs, en, de); unknown values read English. */
    language?: string | null
    /** The clan's message style: clan colour and icon density. */
    style?: MessageStyle | null
    /** Installed application emoji per chip tone, if any. */
    chipIcons?: Partial<Record<ChipTone, string>>
}

/** The layout options (frame copy, locale, style) for a clan. */
export function messageKitLayoutOptions(
    options: MessageKitOptions = {}
): MessageLayoutOptions {
    return {
        copy: getSystemMessages(options.language).kit,
        locale: getIntlLocaleForClanLanguage(options.language),
        style: options.style,
        chipIcons: options.chipIcons,
    }
}

const actionStyles = {
    primary: ButtonStyle.Primary,
    success: ButtonStyle.Success,
    secondary: ButtonStyle.Secondary,
    danger: ButtonStyle.Danger,
} as const

function buildButton(button: MessageButton) {
    const builder = new ButtonBuilder()
        .setLabel(button.label)
        .setDisabled(Boolean(button.disabled))
    if (button.emoji) builder.setEmoji(button.emoji)
    return button.kind === "link"
        ? builder.setStyle(ButtonStyle.Link).setURL(button.url)
        : builder.setStyle(actionStyles[button.style]).setCustomId(button.id)
}

function buildSelect(select: MessageSelect) {
    const builder = new StringSelectMenuBuilder()
        .setCustomId(select.id)
        .setMinValues(select.minValues ?? 1)
        .setMaxValues(select.maxValues ?? 1)
        .setDisabled(Boolean(select.disabled))
        .addOptions(
            select.options.map((option) => ({
                value: option.value,
                label: option.label,
                ...(option.description
                    ? { description: option.description }
                    : {}),
                ...(option.emoji ? { emoji: option.emoji } : {}),
                ...(option.default ? { default: true } : {}),
            }))
        )
    if (select.placeholder) builder.setPlaceholder(select.placeholder)
    return builder
}

function addNode(container: ContainerBuilder, node: LayoutNode) {
    switch (node.type) {
        case "text":
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(node.content)
            )
            return
        case "section": {
            const thumbnail = new ThumbnailBuilder().setURL(node.thumbnail.url)
            if (node.thumbnail.description)
                thumbnail.setDescription(node.thumbnail.description)
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        node.texts.map((text) =>
                            new TextDisplayBuilder().setContent(text)
                        )
                    )
                    .setThumbnailAccessory(thumbnail)
            )
            return
        }
        case "separator":
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(node.divider)
                    .setSpacing(
                        node.spacing === "large"
                            ? SeparatorSpacingSize.Large
                            : SeparatorSpacingSize.Small
                    )
            )
            return
        case "gallery":
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    node.items.map((item) => {
                        const builder = new MediaGalleryItemBuilder().setURL(
                            item.url
                        )
                        if (item.description)
                            builder.setDescription(item.description)
                        return builder
                    })
                )
            )
            return
        case "buttons":
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    node.buttons.map(buildButton)
                )
            )
            return
        case "select":
            container.addActionRowComponents(
                new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    buildSelect(node.select)
                )
            )
    }
}

/** The container of a laid-out message. */
export function buildContainer(layout: MessageLayout) {
    const container = new ContainerBuilder().setAccentColor(layout.accentColor)
    for (const node of layout.nodes) addNode(container, node)
    return container
}

/**
 * Validates the view against the board rules and Discord's limits and
 * builds its container. Throws `InvalidMessageViewError` for a broken view.
 */
export function renderMessageView(
    view: MessageView,
    options: MessageKitOptions = {}
) {
    const layoutOptions = messageKitLayoutOptions(options)
    assertValidMessageView(view, layoutOptions)
    const layout = layoutMessageView(view, layoutOptions)
    return { layout, container: buildContainer(layout) }
}

const noMentions = { parse: [] as never[] }

/** A channel message (post or managed message). Nobody is pinged by default. */
export function messagePayload(
    view: MessageView,
    options: MessageKitOptions = {}
) {
    const { container } = renderMessageView(view, options)
    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: noMentions,
    } satisfies MessageCreateOptions
}

/** An interaction reply; a private view adds the ephemeral flag. */
export function interactionReplyPayload(
    view: MessageView,
    options: MessageKitOptions = {}
) {
    const { container, layout } = renderMessageView(view, options)
    return {
        components: [container],
        flags: layout.ephemeral
            ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            : MessageFlags.IsComponentsV2,
        allowedMentions: noMentions,
    } satisfies InteractionReplyOptions
}

/**
 * An edit that turns any earlier message (plain text, a legacy embed or a
 * V2 card) into this view: content and embeds are cleared because Components
 * V2 messages cannot carry them.
 */
export function editPayload(
    view: MessageView,
    options: MessageKitOptions = {}
) {
    const { container } = renderMessageView(view, options)
    return {
        content: null,
        embeds: [],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: noMentions,
    } satisfies MessageEditOptions & InteractionEditReplyOptions
}
