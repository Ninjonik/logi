import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    type Client,
    type MessageCreateOptions,
} from "discord.js"
import {
    publish,
    PublicationNotSent,
} from "../../../src/application/discord-publications/publish"
import { publicationFiles, componentAttachments } from "./publication-files"
import { fetchOwnedPublicationMessage } from "./owned-message"
import { makeFunctionReference } from "convex/server"
import { createHash } from "node:crypto"
import { env } from "../environment"
import { convex } from "../convex"
export { isUnknownMessage } from "./owned-message"

const discordCode = (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined
/** Unknown Channel (10003): the previous channel was deleted. Permission errors
 * keep the binding so a restored channel never receives a duplicate. */
const isUnknownChannel = (error: unknown) => discordCode(error) === 10003

function hasMarker(value: unknown, marker: string): boolean {
    if (!value || typeof value !== "object") return false
    if ("custom_id" in value && value.custom_id === marker) return true
    return Object.values(value).some((child) =>
        Array.isArray(child)
            ? child.some((v) => hasMarker(v, marker))
            : hasMarker(child, marker)
    )
}
const ref = (name: string) =>
    makeFunctionReference<"mutation">(`discordPublications:${name}`)
export async function publishManagedMessage(
    client: Client,
    input: {
        guildId: string
        key: string
        revision: number
        channelId: string | null
        legacyChannelId?: string
        legacyMessageId?: string
        message: MessageCreateOptions
    }
) {
    const guild = await client.guilds.fetch(input.guildId)
    const channel = async (id: string) => {
        const found = await guild.channels.fetch(id, { force: true })
        if (
            !found ||
            ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
                found.type
            ) ||
            !found.isTextBased()
        )
            throw new Error("Unsupported publication channel.")
        const me = await guild.members.fetchMe({ force: true })
        // Only demand what this message needs; text-only panels must not fail on Attach Files.
        if (
            !found
                .permissionsFor(me)
                ?.has([
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.SendMessages,
                    ...(input.message.embeds?.length
                        ? [PermissionFlagsBits.EmbedLinks]
                        : []),
                    ...(input.message.files?.length
                        ? [PermissionFlagsBits.AttachFiles]
                        : []),
                ])
        )
            throw new Error("Publication channel permissions missing.")
        return found
    }
    const owned = async (id: string, messageId: string) => {
        return fetchOwnedPublicationMessage(
            await channel(id),
            messageId,
            client.user?.id
        )
    }
    // A deleted previous channel means the old message is gone; the publication
    // must move on instead of failing every later sync.
    const previousGone = async (id: string, messageId: string) => {
        try {
            return await owned(id, messageId)
        } catch (error) {
            if (isUnknownChannel(error)) return null
            throw error
        }
    }
    // Serialize builders before hashing; counts/timestamps come from observation data.
    const hash = createHash("sha256")
        .update(JSON.stringify(input.message))
        .digest("hex")
    const result = await publish(
        {
            claim: () =>
                convex.mutation(ref("claim"), {
                    secret: env.internalSecret,
                    guildId: input.guildId,
                    key: input.key,
                    revision: input.revision,
                    ...(input.legacyChannelId
                        ? { legacyChannelId: input.legacyChannelId }
                        : {}),
                    ...(input.legacyMessageId
                        ? { legacyMessageId: input.legacyMessageId }
                        : {}),
                }),
            save: (state) =>
                convex.mutation(ref("save"), {
                    secret: env.internalSecret,
                    ...state,
                }),
            finish: (state, error) =>
                convex.mutation(ref("finish"), {
                    secret: env.internalSecret,
                    id: state.id,
                    fence: state.fence,
                    ...(error
                        ? {
                              error:
                                  error instanceof Error &&
                                  error.message.startsWith("Delivery uncertain")
                                      ? error.message
                                      : "Discord delivery failed; check channel permissions or retry after the service recovers.",
                          }
                        : {}),
                }),
        },
        {
            exists: async (id, messageId) =>
                Boolean(await previousGone(id, messageId)),
            recover: async (id, marker) => {
                const matches = [
                    ...(
                        await (await channel(id)).messages.fetch({ limit: 100 })
                    ).values(),
                ].filter(
                    (message) =>
                        message.author.id === client.user?.id &&
                        hasMarker(
                            message.components.map((c) => c.toJSON()),
                            marker
                        )
                )
                if (matches.length > 1)
                    throw new Error(
                        "Multiple owned publication markers require operator reconciliation."
                    )
                return matches[0]?.id ?? null
            },
            create: async (id, marker) => {
                const destination = await channel(id).catch(() => {
                    throw new PublicationNotSent(
                        "Channel unavailable before send."
                    )
                })
                const markerRow =
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(marker)
                            .setLabel("Automatic updates")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
                const sent = await destination
                    .send({
                        ...input.message,
                        components: [
                            ...(input.message.components ?? []),
                            markerRow,
                        ],
                        allowedMentions: input.message.allowedMentions ?? {
                            parse: [],
                        },
                        nonce: BigInt(
                            `0x${createHash("sha256").update(marker).digest("hex").slice(0, 16)}`
                        ).toString(),
                        enforceNonce: true,
                    })
                    .catch((error) => {
                        if (
                            typeof error?.status === "number" &&
                            [400, 401, 403, 404, 405, 413, 429].includes(
                                error.status
                            )
                        )
                            throw new PublicationNotSent(
                                "Discord rejected the create request."
                            )
                        throw error
                    })
                return sent.id
            },
            edit: async (id, messageId) => {
                const message = await owned(id, messageId)
                if (!message)
                    throw new Error(
                        "Message removed during publication; retry."
                    )
                const { flags, ...body } = input.message
                await message.edit({
                    ...body,
                    ...publicationFiles(body.files, [
                        ...message.attachments.values(),
                        ...componentAttachments(
                            message.components.map((c) => c.toJSON())
                        ),
                    ]),
                    ...(flags
                        ? {
                              content: null,
                              embeds: [],
                              flags: Number(flags) as 32768,
                          }
                        : {}),
                    allowedMentions: { parse: [] },
                })
            },
            remove: async (id, messageId) => {
                const message = await previousGone(id, messageId)
                if (message) await message.delete()
            },
        },
        input.channelId,
        hash
    )
    if (result === undefined)
        throw new Error("Publication busy or configuration changed; retry.")
    return result
}
