import type { Guild } from "@/types/domain"

/** Results shown before the switcher offers "Show all". */
export const WORKSPACE_SWITCHER_PREVIEW = 5

type SearchableWorkspace = Pick<Guild, "id" | "name" | "description">

function workspaceScore(server: SearchableWorkspace, query: string) {
    const normalizedQuery = query.trim().toLowerCase()
    const name = server.name.toLowerCase()
    const description = server.description?.toLowerCase() ?? ""

    if (name === normalizedQuery) return 100
    if (name.startsWith(normalizedQuery)) return 80
    if (name.includes(normalizedQuery)) return 60
    if (description.startsWith(normalizedQuery)) return 40
    if (description.includes(normalizedQuery)) return 20
    return -1
}

/**
 * Every workspace matching the query, best match first (alphabetical without a
 * query). The switcher shows the first few and offers the rest on request.
 */
export function rankWorkspaces<T extends SearchableWorkspace>(
    servers: readonly T[],
    query: string
): T[] {
    if (!query.trim()) {
        return [...servers].sort((left, right) =>
            left.name.localeCompare(right.name)
        )
    }

    return servers
        .map((server) => ({ server, score: workspaceScore(server, query) }))
        .filter((entry) => entry.score >= 0)
        .sort(
            (left, right) =>
                right.score - left.score ||
                left.server.name.localeCompare(right.server.name)
        )
        .map((entry) => entry.server)
}
