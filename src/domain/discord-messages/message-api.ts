/**
 * A {@link MessageView} as the raw Discord API body (Components V2 JSON),
 * for the few cards the web server sends itself, such as the training
 * result DM. The bot uses discord.js builders (`discord-bot/src/ui/`); both
 * lay the view out with `layoutMessageView`, so they send the same card.
 */

import {
    layoutMessageView,
    type LayoutNode,
    type MessageLayoutOptions,
} from "./message-layout"
import type { MessageButton, MessageView } from "./message-view"
import { assertValidMessageView } from "./message-validation"

/** Discord's Components V2 message flag. */
export const COMPONENTS_V2_FLAG = 1 << 15
const EPHEMERAL_FLAG = 1 << 6

const BUTTON_STYLES = {
    primary: 1,
    secondary: 2,
    success: 3,
    danger: 4,
} as const

function emoji(value: string | undefined) {
    if (!value) return undefined
    const custom = value.match(/^<(a)?:([A-Za-z0-9_]{2,32}):(\d{17,20})>$/)
    return custom
        ? { name: custom[2], id: custom[3], animated: Boolean(custom[1]) }
        : { name: value }
}

function button(input: MessageButton) {
    const base = {
        type: 2,
        label: input.label,
        disabled: Boolean(input.disabled),
        ...(input.emoji ? { emoji: emoji(input.emoji) } : {}),
    }
    return input.kind === "link"
        ? { ...base, style: 5, url: input.url }
        : { ...base, style: BUTTON_STYLES[input.style], custom_id: input.id }
}

function node(item: LayoutNode): Record<string, unknown> {
    switch (item.type) {
        case "text":
            return { type: 10, content: item.content }
        case "section":
            return {
                type: 9,
                components: item.texts.map((content) => ({
                    type: 10,
                    content,
                })),
                accessory: {
                    type: 11,
                    media: { url: item.thumbnail.url },
                    ...(item.thumbnail.description
                        ? { description: item.thumbnail.description }
                        : {}),
                },
            }
        case "section-button":
            return {
                type: 9,
                components: item.texts.map((content) => ({
                    type: 10,
                    content,
                })),
                accessory: button(item.button),
            }
        case "separator":
            return {
                type: 14,
                divider: item.divider,
                spacing: item.spacing === "large" ? 2 : 1,
            }
        case "gallery":
            return {
                type: 12,
                items: item.items.map((media) => ({
                    media: { url: media.url },
                    ...(media.description
                        ? { description: media.description }
                        : {}),
                })),
            }
        case "buttons":
            return { type: 1, components: item.buttons.map(button) }
        case "select":
            return {
                type: 1,
                components: [
                    {
                        type: 3,
                        custom_id: item.select.id,
                        min_values: item.select.minValues ?? 1,
                        max_values: item.select.maxValues ?? 1,
                        disabled: Boolean(item.select.disabled),
                        ...(item.select.placeholder
                            ? { placeholder: item.select.placeholder }
                            : {}),
                        options: item.select.options.map((option) => ({
                            value: option.value,
                            label: option.label,
                            ...(option.description
                                ? { description: option.description }
                                : {}),
                            ...(option.emoji
                                ? { emoji: emoji(option.emoji) }
                                : {}),
                            ...(option.default ? { default: true } : {}),
                        })),
                    },
                ],
            }
    }
}

/**
 * The API body of a card: validated against the board rules and Discord's
 * limits, one container with the accent bar, and no pings.
 */
export function messageApiBody(
    view: MessageView,
    options: MessageLayoutOptions
) {
    assertValidMessageView(view, options)
    const layout = layoutMessageView(view, options)
    return {
        flags: layout.ephemeral
            ? COMPONENTS_V2_FLAG | EPHEMERAL_FLAG
            : COMPONENTS_V2_FLAG,
        allowed_mentions: { parse: [] as string[] },
        components: [
            {
                type: 17,
                accent_color: layout.accentColor,
                components: layout.nodes.map(node),
            },
        ],
    }
}
