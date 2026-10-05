import {
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    type Client,
    type MessageCreateOptions,
} from "discord.js"
import {
    findPublicationMessage,
    PUBLICATION_RENDER_VERSION,
    publicationCreatePayload,
} from "./publication-marker"
import {
    publish,
    PublicationNotSent,
} from "../../../src/application/discord-publications/publish"
import { publicationFiles, componentAttachments } from "./publication-files"
import { getSystemMessages } from "../../../src/lib/clan-language/system"
import { clanLanguageForGuild } from "../runtime/clan-language"
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

/**
 * Why a publication channel cannot take the message, so the dashboard can
 * name the cause and the fix (P1-16): the channel is gone, is not a text
 * channel, or the bot lacks named permissions there.
 */
export class PublicationChannelError extends Error {
    constructor(
        readonly reason:
            "channel_missing" | "channel_type" | "missing_permissions",
        readonly permissions: string[] = []
    ) {
        super(
            reason === "missing_permissions"
                ? "Publication channel permissions missing."
                : "Unsupported publication channel."
        )
        this.name = "PublicationChannelError"
    }
}

/**
 * The content hash of a message: file contents are versioned by their names,
 * so the bytes themselves are not hashed (a re-used image is not an edit).
 */
export function publicationHash(message: MessageCreateOptions) {
    const files = (message.files ?? []).map((file) =>
        file && typeof file === "object" && "name" in file
            ? String(file.name)
            : "file"
    )
    return createHash("sha256")
        .update(PUBLICATION_RENDER_VERSION)
        .update(JSON.stringify({ ...message, files }))
        .digest("hex")
}
/** Unknown Channel (10003): the previous channel was deleted. Permission errors
 * keep the binding so a restored channel never receives a duplicate. */
const isUnknownChannel = (error: unknown) => discordCode(error) === 10003

/**
 * The last delivery error stored for the dashboard, in the clan language:
 * an uncertain create (never re-sent) or a failed delivery. No internal
 * error text reaches the clan.
 */
export function publicationDeliveryError(
    language: string | null | undefined,
    error: unknown
) {
    const copy = getSystemMessages(language).publication
    return error instanceof Error &&
        error.message.startsWith("Delivery uncertain")
        ? copy.deliveryUncertain
        : copy.deliveryFailed
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
        const found = await guild.channels
            .fetch(id, { force: true })
            .catch((error: unknown) => {
                if (isUnknownChannel(error))
                    throw new PublicationChannelError("channel_missing")
                throw error
            })
        if (!found) throw new PublicationChannelError("channel_missing")
        if (
            ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(
                found.type
            ) ||
            !found.isTextBased()
        )
            throw new PublicationChannelError("channel_type")
        const me = await guild.members.fetchMe({ force: true })
        // Only demand what this message needs; text-only panels must not fail on Attach Files.
        const missing =
            found
                .permissionsFor(me)
                ?.missing([
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.SendMessages,
                    ...(input.message.embeds?.length
                        ? [PermissionFlagsBits.EmbedLinks]
                        : []),
                    ...(input.message.files?.length
                        ? [PermissionFlagsBits.AttachFiles]
                        : []),
                ]) ?? []
        if (missing.length || !found.permissionsFor(me))
            throw new PublicationChannelError(
                "missing_permissions",
                missing.length ? missing : ["ViewChannel"]
            )
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
    // The render version re-edits every message once when the payload shape changes.
    const hash = publicationHash(input.message)
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
            finish: async (state, error) =>
                convex.mutation(ref("finish"), {
                    secret: env.internalSecret,
                    id: state.id,
                    fence: state.fence,
                    ...(error
                        ? {
                              error: publicationDeliveryError(
                                  await clanLanguageForGuild(input.guildId),
                                  error
                              ),
                          }
                        : {}),
                }),
        },
        {
            exists: async (id, messageId) =>
                Boolean(await previousGone(id, messageId)),
            // Only an uncertain create is recovered this way; every other
            // step uses the stored message ID.
            recover: async (id, marker) =>
                findPublicationMessage(
                    (
                        await (await channel(id)).messages.fetch({ limit: 100 })
                    ).values(),
                    marker,
                    client.user?.id
                ),
            create: async (id, marker) => {
                const destination = await channel(id).catch(
                    (error: unknown) => {
                        throw Object.assign(
                            new PublicationNotSent(
                                "Channel unavailable before send."
                            ),
                            { cause: error }
                        )
                    }
                )
                // No visible marker: the first component carries an
                // invisible id for recovering an uncertain create.
                const sent = await destination
                    .send(publicationCreatePayload(input.message, marker))
                    .catch((error) => {
                        if (
                            typeof error?.status === "number" &&
                            [400, 401, 403, 404, 405, 413, 429].includes(
                                error.status
                            )
                        )
                            throw Object.assign(
                                new PublicationNotSent(
                                    "Discord rejected the create request."
                                ),
                                { cause: error }
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
                // Discord cannot turn a Components V2 message back into a
                // classic one: remove it, and the next pass sends it anew.
                if (!flags && message.flags.has(MessageFlags.IsComponentsV2)) {
                    await message.delete()
                    throw new Error(
                        "Message removed during publication; retry."
                    )
                }
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
