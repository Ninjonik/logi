import type { InteractionEditReplyOptions } from "discord.js"
export async function completePrivatePlayerReply(
    editReply: (reply: InteractionEditReplyOptions) => Promise<unknown>,
    load: () => Promise<InteractionEditReplyOptions>,
    timeoutMs = 12_000
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
            content: "Player details unavailable. Please try again later.",
            components: [],
            allowedMentions: { parse: [] },
        })
    } finally {
        clearTimeout(timer)
    }
}
