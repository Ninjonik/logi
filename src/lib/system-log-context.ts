const sensitiveKey =
    /^(authorization|cookie|setcookie|password|passwd|token|accesstoken|refreshtoken|bottoken|discordbottoken|secret|internalauthsecret|clientsecret|apikey|oauthcode)$/i

/** Bound diagnostics before serialization, including cycles through Error.cause. */
export function sanitizeLogContext(
    context?: Record<string, unknown>
): Record<string, unknown> | null {
    if (!context) return null
    const seen = new WeakSet<object>()
    let remainingNodes = 200
    let remainingText = 16_384
    const visit = (value: unknown, depth: number): unknown => {
        if (--remainingNodes < 0) return "[truncated]"
        if (typeof value === "string") {
            const length = Math.min(value.length, 4096, remainingText)
            remainingText -= length
            return (
                value.slice(0, length) +
                (length < value.length ? "[truncated]" : "")
            )
        }
        if (typeof value === "bigint") return String(value)
        if (!value || typeof value !== "object") return value
        if (seen.has(value)) return "[circular]"
        if (depth >= 6) return "[truncated]"
        seen.add(value)
        try {
            if (Array.isArray(value))
                return value
                    .slice(0, 50)
                    .map((entry) => visit(entry, depth + 1))
            const entries =
                value instanceof Error
                    ? ([
                          ["name", value.name],
                          ["message", value.message],
                          ["stack", value.stack],
                          [
                              "cause",
                              (value as Error & { cause?: unknown }).cause,
                          ],
                      ] as const)
                    : Object.entries(value).slice(0, 50)
            return Object.fromEntries(
                entries
                    .filter(([, entry]) => entry !== undefined)
                    .map(([key, entry]) => [
                        key.slice(0, 128),
                        sensitiveKey.test(key.replace(/[^a-z]/gi, ""))
                            ? "[redacted]"
                            : visit(entry, depth + 1),
                    ])
            )
        } catch {
            return "[unreadable]"
        }
    }
    const result = visit(context, 0)
    return result && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : { context: result }
}
