import { recheckDisplayName } from "@/application/users/recheck-display-name"
import { fetchDiscordGuildMember } from "@/lib/discord"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchMutation } from "convex/nextjs"

export function recheckPlayerDisplayName(input: {
    guildId: string
    discordId: string
}) {
    return recheckDisplayName(input, {
        fetchMember: fetchDiscordGuildMember,
        saveName: async (name) =>
            await fetchMutation(
                makeFunctionReference<
                    "mutation",
                    {
                        secret: string
                        guildId: string
                        discordId: string
                        name: string
                    },
                    { changed: boolean }
                >("users:updateServerDisplayName"),
                { ...input, name, secret: getInternalAuthSecret() }
            ),
    })
}
