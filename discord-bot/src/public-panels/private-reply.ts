import type { InteractionEditReplyOptions } from "discord.js"
export async function completePrivatePlayerReply(
    editReply: (reply: InteractionEditReplyOptions) => Promise<unknown>,
    load: () => Promise<InteractionEditReplyOptions>,
    timeoutMs = 12_000,
    fallbackContent = "Player details unavailable. Please try again later."
) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        const reply = await Promise.race([
            load(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Player data timeout")),
                    timeoutMs
                )
            }),
        ])
        await editReply(reply)
    } catch {
        await editReply({
            content: fallbackContent,
            components: [],
            allowedMentions: { parse: [] },
        })
    } finally {
        clearTimeout(timer)
    }
}
