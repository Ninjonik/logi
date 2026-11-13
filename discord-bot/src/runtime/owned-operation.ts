/** A slow-operation warning must never release ownership of uncancelled work. */
export async function awaitOwnedOperation<T>(
    operation: Promise<T>,
    warningMs: number,
    onSlow: () => void
): Promise<T> {
    const timer = setTimeout(() => {
        // Diagnostics cannot break the operation or escape the timer callback.
        try {
            onSlow()
        } catch {
            /* best effort */
        }
    }, warningMs)
    try {
        return await operation
    } finally {
        clearTimeout(timer)
    }
}
