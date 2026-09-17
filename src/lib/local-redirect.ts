/** Keeps post-auth redirects on this site and rejects protocol-relative URLs. */
export function sanitizeLocalRedirect(
    value: string | null | undefined,
    fallback: string
) {
    if (
        !value ||
        !value.startsWith("/") ||
        value.startsWith("//") ||
        value.includes("\\")
    ) {
        return fallback
    }

    try {
        const redirectUrl = new URL(value, "https://logi.local")
        if (redirectUrl.origin !== "https://logi.local") {
            return fallback
        }

        return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
    } catch {
        return fallback
    }
}
