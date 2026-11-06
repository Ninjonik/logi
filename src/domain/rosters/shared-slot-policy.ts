/** The allocation is controlled by the host, independently of the player. */
export type SharedSlot = {
    allocatedGuildId?: string
    locked?: boolean
}

/**
 * The caller must first authenticate the actor and verify that their clan has
 * an active invitation. This rule only decides access to an existing slot.
 */
export function canEditSharedSlot(input: {
    hostGuildId: string
    actorGuildId: string
    invitationActive: boolean
    slot: SharedSlot
}): boolean {
    if (input.actorGuildId === input.hostGuildId) return true
    return (
        input.invitationActive &&
        input.slot.allocatedGuildId === input.actorGuildId &&
        input.slot.locked !== true
    )
}
