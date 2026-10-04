export async function endDashboardSession<T extends { sub: string }>(
    ports: {
        session(token: string): Promise<T | null>
        revoke(session: T, allSessions: boolean): Promise<void>
        cancelSteam(token: string, subject: string): Promise<void>
        clearCookie(): void
    },
    token: string | undefined,
    allSessions: boolean
) {
    if (token) {
        const session = await ports.session(token)
        if (session) {
            try {
                await ports.revoke(session, allSessions)
            } finally {
                await ports
                    .cancelSteam(token, session.sub)
                    .catch(() => undefined)
            }
        }
    }
    // Retain the cookie when persistence fails: a retry must be able to revoke it.
    ports.clearCookie()
}
