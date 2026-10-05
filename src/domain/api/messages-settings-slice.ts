/**
 * `/api/v1` clan settings slice `messages`: the "Zprávy a panely" page
 * (board N1-B10) besides the match message defaults of `matchMessages`
 * and the errors channel, which is a plain settings field
 * (`errorsChannelId`). The clan colour and icon density of every bot
 * message, and the switches of the messages a clan can turn off. The
 * faction signs are fixed (board P8), so there is nothing to set.
 */

import { z } from "zod"

import {
    MESSAGE_SWITCH_FIELDS,
    MESSAGE_SWITCH_KEYS,
    messageSettingsPatch,
    resolveMessageSwitches,
    type StoredMessageSwitches,
} from "../discord-messages/notification-settings"
import {
    MESSAGE_ICON_DENSITIES,
    normalizeAccentColor,
    normalizeMessageStyle,
} from "../discord-messages/message-style"
import { defineClanSettingsSlice } from "./settings-slices"

const switchDescriptions = {
    debriefPost:
        "Whether the Debrief post is created in the match forum after the match.",
    scheduledEvent:
        "Whether the bot keeps a Discord scheduled event with the meeting time.",
    matchRecapDm:
        "Whether players get the match recap DM (each player can still turn it off).",
    trainingResultDm: "Whether participants get the training result DM.",
    applicationCloseDm:
        "Whether the applicant gets a DM when the application is closed.",
    ticketCloseDm: "Whether the author gets a DM when the ticket is closed.",
} as const

const switches = {
    debriefPost: z.boolean().describe(switchDescriptions.debriefPost),
    scheduledEvent: z.boolean().describe(switchDescriptions.scheduledEvent),
    matchRecapDm: z.boolean().describe(switchDescriptions.matchRecapDm),
    trainingResultDm: z.boolean().describe(switchDescriptions.trainingResultDm),
    applicationCloseDm: z
        .boolean()
        .describe(switchDescriptions.applicationCloseDm),
    ticketCloseDm: z.boolean().describe(switchDescriptions.ticketCloseDm),
}

const accentColor = z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .describe(
        "The clan colour of every bot message as #RRGGBB; null means the Logi default #E8A33D."
    )
const iconDensity = z
    .enum(MESSAGE_ICON_DENSITIES)
    .describe(
        "Icons in messages: sparse (only where needed) or rich (an emoji on every line)."
    )

const schema = z.object({ accentColor, iconDensity, ...switches })

export const messagesSettingsSlice = defineClanSettingsSlice({
    key: "messages",
    description:
        "Discord messages: the clan colour and icon density of every bot message, and the switches of the messages a clan can turn off.",
    schema,
    patchSchema: schema.partial().strict(),
    read: ({ discordConfig }) => {
        const style = normalizeMessageStyle(
            (discordConfig?.messageStyle ?? null) as {
                accentColor?: unknown
                iconDensity?: unknown
            } | null
        )
        return {
            accentColor: style.accentColor ?? null,
            iconDensity: style.iconDensity ?? "sparse",
            ...resolveMessageSwitches(
                discordConfig as StoredMessageSwitches | null
            ),
        }
    },
    toPatch: (patch, { discordConfig }) => {
        const fields: Record<string, unknown> = {
            ...messageSettingsPatch(
                Object.fromEntries(
                    MESSAGE_SWITCH_KEYS.filter(
                        (key) => patch[key] !== undefined
                    ).map((key) => [key, patch[key]])
                )
            ),
        }
        if (patch.accentColor !== undefined || patch.iconDensity) {
            // The style is stored as one object; keep the half not sent.
            const current = normalizeMessageStyle(
                (discordConfig?.messageStyle ?? null) as {
                    accentColor?: unknown
                    iconDensity?: unknown
                } | null
            )
            const color =
                patch.accentColor === undefined
                    ? current.accentColor
                    : (normalizeAccentColor(patch.accentColor) ?? undefined)
            fields.messageStyle = {
                iconDensity:
                    patch.iconDensity ?? current.iconDensity ?? "sparse",
                ...(color ? { accentColor: color } : {}),
            }
        }
        return fields
    },
})

/** The stored fields this slice writes, for the coverage docs and tests. */
export const MESSAGES_SLICE_FIELDS = [
    "messageStyle",
    ...MESSAGE_SWITCH_KEYS.map((key) => MESSAGE_SWITCH_FIELDS[key]),
] as const
