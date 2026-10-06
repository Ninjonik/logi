import type { BotPermission } from "../../../src/domain/discord-messages/bot-errors"

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
 * The publication channel lacks permissions the message needs. It is a
 * `PublicationChannelError` ("missing_permissions") for the panel and seed
 * classifiers, and names the channel for the errors channel (L5).
 */
export class PublicationPermissionError extends PublicationChannelError {
    constructor(
        readonly missing: BotPermission[],
        readonly channelName: string,
        /** The channel's ID, so the errors channel can mention it. */
        readonly channelId?: string
    ) {
        super("missing_permissions", missing)
        this.name = "PublicationPermissionError"
    }
}
