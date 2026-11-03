/** Cache failure must not turn an already committed Discord write into a failed write. */
export async function deliverCacheInvalidation(deps: {
    send(): Promise<Pick<Response, "ok" | "status">>
    wait(ms: number): Promise<void>
    report(final: boolean, attempt: number, status: number | undefined): void
}): Promise<boolean> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        let status: number | undefined
        try {
            const response = await deps.send()
            if (response.ok) return true
            status = response.status
        } catch {
            // Do not log request errors, URLs, or bodies carrying the internal secret.
        }
        const permanent =
            status !== undefined &&
            status >= 400 &&
            status < 500 &&
            status !== 429
        const final = permanent || attempt === 3
        deps.report(final, attempt, status)
        if (final) return false
        await deps.wait(attempt * 250)
    }
    return false
}
