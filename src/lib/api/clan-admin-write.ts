/**
 * A browser write to a clan's management data is accepted only from the
 * dashboard's public origin and for a current clan admin with a live dashboard
 * session. Denial happens before the body is read.
 */
export function createClanAdminWriteGuard(deps: {
    origin: string
    canAdminServer: (serverId: string) => Promise<boolean>
}) {
    return async function clanAdminWriteDenied(
        request: Request,
        serverId: string
    ): Promise<Response | null> {
        const allowed =
            request.headers.get("origin") === deps.origin &&
            (await deps.canAdminServer(serverId).catch(() => false))
        return allowed
            ? null
            : Response.json(
                  { error: "forbidden" },
                  { status: 403, headers: { "Cache-Control": "no-store" } }
              )
    }
}
