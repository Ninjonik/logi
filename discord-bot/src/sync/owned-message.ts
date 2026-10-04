import type { TextChannel } from "discord.js"
export const isUnknownMessage = (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 10008

export async function fetchOwnedPublicationMessage(
    channel: { messages: Pick<TextChannel["messages"], "fetch"> },
    messageId: string,
    botUserId: string | undefined
) {
    try {
        const message = await channel.messages.fetch({
            message: messageId,
            force: true,
            cache: false,
        })
        if (message.author.id !== botUserId)
            throw new Error("Publication message ownership mismatch.")
        return message
    } catch (error) {
        if (isUnknownMessage(error)) return null
        throw error
    }
}
