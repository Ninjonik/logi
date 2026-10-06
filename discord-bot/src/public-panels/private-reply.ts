import type { InteractionEditReplyOptions } from "discord.js"

/**
 * Completes a deferred private reply with what `load` builds, or with the
 * fallback card when loading fails or takes longer than Discord allows.
 */
export async function completePrivatePlayerReply(
    editReply: (reply: InteractionEditReplyOptions) => Promise<unknown>,
    load: () => Promise<InteractionEditReplyOptions>,
    timeoutMs: number,
    fallback: InteractionEditReplyOptions
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
        await editReply(fallback)
    } finally {
        clearTimeout(timer)
    }
}
