import {
    ChannelType,
    RESTJSONErrorCodes,
    Routes,
    type Client,
} from "discord.js"

/** Read only roster candidates, on demand; never use or populate a voice cache. */
export async function getMeetingChannelMemberIds(
    client: Pick<Client, "guilds" | "rest">,
    guildId: string,
    meetingChannelId: string,
    rosterUserIds: string[]
) {
    const guild = await client.guilds.fetch(guildId)
    const channel = await guild.channels.fetch(meetingChannelId)
    if (
        !channel ||
        (channel.type !== ChannelType.GuildVoice &&
            channel.type !== ChannelType.GuildStageVoice)
    ) {
        throw new Error(
            "Configured meeting channel is not a voice or stage channel."
        )
    }

    const candidates = [...new Set(rosterUserIds)]
    const present = new Set<string>()
    const signal = AbortSignal.timeout(30_000)
    let next = 0
    // Keep Discord's rate-limit handling and bound concurrency and request lifetime.
    await Promise.all(
        Array.from({ length: Math.min(5, candidates.length) }, async () => {
            while (next < candidates.length) {
                signal.throwIfAborted()
                const userId = candidates[next++]
                let state: unknown
                try {
                    state = await client.rest.get(
                        Routes.guildVoiceState(guildId, userId),
                        { signal }
                    )
                } catch (error) {
                    // Discord's explicit "Unknown Voice State" means disconnected.
                    if (
                        typeof error === "object" &&
                        error !== null &&
                        "code" in error &&
                        error.code === RESTJSONErrorCodes.UnknownVoiceState
                    )
                        continue
                    throw error
                }
                if (
                    typeof state !== "object" ||
                    state === null ||
                    !("user_id" in state) ||
                    state.user_id !== userId ||
                    !("channel_id" in state) ||
                    (state.channel_id !== null &&
                        typeof state.channel_id !== "string")
                ) {
                    throw new Error("Discord returned an invalid voice state.")
                }
                if (state.channel_id === meetingChannelId) present.add(userId)
            }
        })
    )
    return candidates.filter((userId) => present.has(userId))
}
