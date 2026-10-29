export async function recheckDisplayName(
    input: { guildId: string; discordId: string },
    ports: {
        fetchMember: (
            guildId: string,
            discordId: string
        ) => Promise<{
            user?: { id: string; username: string; global_name?: string | null }
            nick?: string | null
        }>
        saveName: (name: string) => Promise<{ changed: boolean }>
    }
) {
    if (!/^\d{17,20}$/.test(input.discordId)) {
        throw new Error("Player has no linked Discord account.")
    }
    const member = await ports.fetchMember(input.guildId, input.discordId)
    if (member.user?.id !== input.discordId) {
        throw new Error("Discord member does not match the player.")
    }
    const name =
        member.nick?.trim() ||
        member.user.global_name?.trim() ||
        member.user.username.trim()
    if (!name) throw new Error("Discord member has no display name.")
    return { name, ...(await ports.saveName(name)) }
}
