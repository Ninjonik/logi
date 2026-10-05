import {
    botErrorSummary,
    classifyDiscordFailure,
    type BotErrorFacts,
    type BotErrorSource,
    type BotPermission,
} from "../../../src/domain/discord-messages/bot-errors"
import {
    findPublicationMessage,
    PUBLICATION_RENDER_VERSION,
    publicationCreatePayload,
} from "./publication-marker"
import {
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
import { getSystemMessages } from "../../../src/lib/clan-language/system"
import { clanLanguageForGuild } from "../runtime/clan-language"
import { fetchOwnedPublicationMessage } from "./owned-message"
import { discordFailureOf } from "../error-reporting"
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

/** The publication channel lacks permissions the message needs. */
export class PublicationPermissionError extends Error {
    constructor(
        readonly missing: BotPermission[],
        readonly channelName: string
    ) {
        super("Publication channel permissions missing.")
    }
}

/** What a managed message is, by its key, for the stored error's title. */
export function publicationSource(key: string | undefined): BotErrorSource {
    if (key?.startsWith("event:"))
        return /:roster(-changes)?$/.test(key) ? "roster" : "announcement"
    if (key === "ticket") return "ticketPanel"
    if (key === "membership") return "applicationPanel"
    if (key === "calendar") return "calendarPanel"
    return "publicPanel"
}

/**
 * The last delivery error stored for the dashboard, in the clan language
 * (board L5-44): an uncertain create (never re-sent) or the errors
 * channel's title, "Proč" and "Co udělat" for the failure. No internal
 * error text reaches the clan.
 */
export function publicationDeliveryError(
    language: string | null | undefined,
    error: unknown,
    key?: string
) {
    const copy = getSystemMessages(language)
    if (
        error instanceof Error &&
        error.message.startsWith("Delivery uncertain")
    )
        return copy.publication.deliveryUncertain
    const wrapped =
        error instanceof PublicationNotSent && "deliveryCause" in error
            ? (error as { deliveryCause: unknown }).deliveryCause
            : undefined
    const cause = wrapped ?? error
    const facts: BotErrorFacts =
        cause instanceof PublicationPermissionError
            ? {
                  failure: "missingPermission",
                  missingPermissions: cause.missing,
                  channel: `#${cause.channelName}`,
              }
            : { failure: classifyDiscordFailure(discordFailureOf(cause)) }
    return botErrorSummary(
        copy.errorsChannel,
        copy.locale,
        publicationSource(key),
        facts
    )
}

/** The permissions a managed message needs in its channel. */
function publicationPermissions(
    message: MessageCreateOptions
): BotPermission[] {
    return [
        "ViewChannel",
        "ReadMessageHistory",
        "SendMessages",
        ...(message.embeds?.length ? (["EmbedLinks"] as const) : []),
        ...(message.files?.length ? (["AttachFiles"] as const) : []),
    ]
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
        const granted = found.permissionsFor(me)
        const missing = publicationPermissions(input.message).filter(
            (permission) => !granted?.has(PermissionFlagsBits[permission])
        )
        if (missing.length)
            throw new PublicationPermissionError(missing, found.name)
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
    const hash = createHash("sha256")
        .update(PUBLICATION_RENDER_VERSION)
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
            finish: async (state, error) =>
                convex.mutation(ref("finish"), {
                    secret: env.internalSecret,
                    id: state.id,
                    fence: state.fence,
                    ...(error
                        ? {
                              error: publicationDeliveryError(
                                  await clanLanguageForGuild(input.guildId),
                                  error,
                                  input.key
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
                const destination = await channel(id).catch((cause) => {
                    // The cause says why, for the stored error (L5-44).
                    throw Object.assign(
                        new PublicationNotSent(
                            "Channel unavailable before send."
                        ),
                        { deliveryCause: cause }
                    )
                })
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
