/** What a person's account says about the clans they belong to or manage. */
export type WorkspaceAccessFacts = {
    userDiscordId: string
    primaryGuildId?: string
    managedGuildIds: readonly string[]
    mercenaryGuildIds: readonly string[]
    /** Clans with a non-pending member or reserve-member assignment. */
    memberGuildIds?: readonly string[]
    /** Discord servers where the bot recorded dashboard access for the person. */
    dashboardAccessGuildIds: readonly string[]
}

/** The clan being opened, identified by its Discord server ID. */
export type WorkspaceAccessTarget = {
    discordId: string
    adminIds: readonly string[]
    dashboardAdminIds?: readonly string[]
}

/**
 * Whether a person may open a clan workspace: their primary, managed,
 * mercenary or member clans, dashboard access granted by the bot, or a stored
 * admin assignment.
 */
export function canOpenWorkspace(
    facts: WorkspaceAccessFacts,
    workspace: WorkspaceAccessTarget
): boolean {
    const id = workspace.discordId
    return (
        facts.primaryGuildId === id ||
        facts.managedGuildIds.includes(id) ||
        facts.mercenaryGuildIds.includes(id) ||
        Boolean(facts.memberGuildIds?.includes(id)) ||
        facts.dashboardAccessGuildIds.includes(id) ||
        workspace.adminIds.includes(facts.userDiscordId) ||
        Boolean(workspace.dashboardAdminIds?.includes(facts.userDiscordId))
    )
}
