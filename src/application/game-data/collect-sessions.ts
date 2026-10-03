import type { ProviderSession } from "../../domain/game-data/contracts"
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
export async function collectSessions(
    progress: HistoryProgress,
    ports: Ports
): Promise<"completed" | "continued" | "stale_fence"> {
    const page = progress.pendingIds.length
        ? { ids: progress.pendingIds, nextPage: progress.nextPage }
        : await ports.readPage(progress.page)
    const [id, ...remaining] = [...new Set(page.ids)]
    const session = id ? await ports.readSession(id) : null
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
