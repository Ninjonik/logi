type Candidate = {
    user: {
        name: string
        discordId: string
        nicknames: Readonly<Record<string, string | undefined>>
    }
    existingHere?: unknown
}

/** Search Logi identity and this server's display name, excluding existing assignments when adding. */
export function searchAssignmentCandidates<T extends Candidate>(
    candidates: readonly T[],
    input: { query: string; guildId: string; createMode: boolean }
) {
    const query = input.query.trim().toLowerCase()
    return candidates.filter(({ user, existingHere }) => {
        if (input.createMode && existingHere) return false
        return (
            !query ||
            user.name.toLowerCase().includes(query) ||
            user.discordId.includes(query) ||
            (user.nicknames[input.guildId] ?? "").toLowerCase().includes(query)
        )
    })
}
