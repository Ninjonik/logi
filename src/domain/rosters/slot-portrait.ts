/** Foreign allocated slots use the clan identity in each local roster image. */
export function rosterSlotPortrait(input: {
    localGuildId: string
    hostGuildId?: string
    allocatedGuildId?: string
    playerAvatar?: string
    clans: readonly { guildId: string; avatar?: string }[]
}) {
    const guildId = input.allocatedGuildId ?? input.hostGuildId
    if (guildId && guildId !== input.localGuildId)
        return input.clans.find((clan) => clan.guildId === guildId)?.avatar
    return input.playerAvatar
}
