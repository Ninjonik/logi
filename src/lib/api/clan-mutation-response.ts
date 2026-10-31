export type ClanMutationResult = { status: number; body: string }

/** Keep the recorded v1 response byte-for-byte, including idempotent replays. */
export function createClanMutationResponder(deps: {
    invalidate(guildId: string, body: string): Promise<void>
    onInvalidationError(error: unknown): void
}) {
    return async (
        result: ClanMutationResult,
        auth: { guildId: string; headers: Record<string, string> }
    ) => {
        if (result.status >= 200 && result.status < 300) {
            try {
                await deps.invalidate(auth.guildId, result.body)
            } catch (error) {
                // The transaction has committed. A cache failure must not turn it into an ambiguous write failure.
                deps.onInvalidationError(error)
            }
        }
        return new Response(result.body, {
            status: result.status,
            headers: { ...auth.headers, "Content-Type": "application/json" },
        })
    }
}
