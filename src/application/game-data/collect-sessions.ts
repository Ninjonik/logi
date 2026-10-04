import {
    ProviderError,
    type ProviderSession,
} from "../../domain/game-data/contracts"
export type HistoryProgress = {
    page: number
    pendingIds: string[]
    nextPage: number | null
}
export type HistoryCommit = {
    session: ProviderSession | null
    progress: HistoryProgress
    completed: boolean
}
type Ports = {
    readPage(page: number): Promise<{ ids: string[]; nextPage: number | null }>
    readSession(id: string): Promise<ProviderSession>
    commit(value: HistoryCommit): Promise<boolean>
}
/** A session the provider no longer serves (or serves malformed) is skipped so the
 * remaining history still arrives; transient provider failures keep retrying it. */
async function readOrSkip(id: string, ports: Ports) {
    try {
        return await ports.readSession(id)
    } catch (error) {
        if (
            error instanceof ProviderError &&
            error.category === "invalid_response"
        )
            return null
        throw error
    }
}
export async function collectSessions(
    progress: HistoryProgress,
    ports: Ports
): Promise<"completed" | "continued" | "stale_fence"> {
    const page = progress.pendingIds.length
        ? { ids: progress.pendingIds, nextPage: progress.nextPage }
        : await ports.readPage(progress.page)
    const [id, ...remaining] = [...new Set(page.ids)]
    const session = id ? await readOrSkip(id, ports) : null
    const completed = remaining.length === 0 && page.nextPage === null
    const next = completed
        ? { page: 1, pendingIds: [], nextPage: null }
        : remaining.length
          ? {
                page: progress.page,
                pendingIds: remaining,
                nextPage: page.nextPage,
            }
          : { page: page.nextPage!, pendingIds: [], nextPage: null }
    if (!(await ports.commit({ session, progress: next, completed })))
        return "stale_fence"
    return completed ? "completed" : "continued"
}
