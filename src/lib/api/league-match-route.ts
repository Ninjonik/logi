import type { Served } from "../../application/wardogs-league/read-match"
import { leagueReadSchema } from "../../domain/wardogs-league/contracts"
import { matchUrl } from "../../domain/wardogs-league/match-url"
export async function leagueMatchResponse(
    request: Request,
    read: (url: string) => Promise<Served>,
    headers: Record<string, string> = {}
) {
    const responseHeaders = { ...headers, "Cache-Control": "no-store" }
    const error = (code: string, status: number) =>
        Response.json(
            {
                error: {
                    code,
                    message:
                        "Public match preview is unavailable or not permitted.",
                },
            },
            { status, headers: responseHeaders }
        )
    const params = new URL(request.url).searchParams
    let source: string
    try {
        if (
            [...params.keys()].some((k) => k !== "game" && k !== "url") ||
            params.getAll("game").length !== 1 ||
            params.get("game") !== "wardogs" ||
            params.getAll("url").length !== 1
        )
            return error("invalid_query", 400)
        source = matchUrl(params.get("url")!).url
    } catch {
        return error("invalid_query", 400)
    }
    try {
        const result = await read(source)
        if (result.kind === "denied") return error("insufficient_scope", 403)
        const data = leagueReadSchema.parse(result.data)
        const status = data.snapshot
            ? 200
            : data.error === "rate_limited"
              ? 429
              : 503
        return Response.json(
            { data },
            {
                status,
                headers: {
                    ...responseHeaders,
                    ...(data.error
                        ? {
                              "Retry-After": String(
                                  Math.max(
                                      1,
                                      Math.ceil(
                                          (Date.parse(data.nextRefreshAt) -
                                              Date.now()) /
                                              1000
                                      )
                                  )
                              ),
                          }
                        : {}),
                },
            }
        )
    } catch {
        return error("league_unavailable", 503)
    }
}
