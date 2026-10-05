export type DashboardLanding =
    { kind: "clanList" } | { kind: "workspace"; workspaceId: string }

/**
 * Where the dashboard entry page sends a signed-in person.
 *
 * - The clan list stays reachable on request (`showClanList`), so people with
 *   several clans can always pick another one.
 * - A stored or resolved default opens only when it is among the workspaces
 *   the person can see right now; a stale default never redirects.
 */
export function chooseDashboardLanding(input: {
    showClanList: boolean
    visibleWorkspaceIds: ReadonlySet<string>
    candidates: ReadonlyArray<string | null | undefined>
}): DashboardLanding {
    if (input.showClanList) return { kind: "clanList" }
    for (const candidate of input.candidates) {
        if (candidate && input.visibleWorkspaceIds.has(candidate)) {
            return { kind: "workspace", workspaceId: candidate }
        }
    }
    return { kind: "clanList" }
}

/** Query value that keeps the dashboard entry page on the clan list. */
export const CLAN_LIST_QUERY = { key: "clans", value: "all" } as const
