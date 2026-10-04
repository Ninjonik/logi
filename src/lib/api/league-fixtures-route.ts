export function parseLeagueFixtureQuery(request: Request) {
    const params = new URL(request.url).searchParams
    if (
        params.getAll("game").length !== 1 ||
        params.get("game") !== "wardogs" ||
        [...params.keys()].some(
            (k) => !["game", "cursor", "limit"].includes(k)
        ) ||
        params.getAll("cursor").length > 1 ||
        params.getAll("limit").length > 1
    )
        return null
    const raw = params.get("limit") ?? "50",
        cursor = params.get("cursor")
    if (
        !/^\d{1,3}$/.test(raw) ||
        Number(raw) < 1 ||
        Number(raw) > 100 ||
        (cursor !== null && (!cursor || cursor.length > 4096))
    )
        return null
    return { cursor, limit: Number(raw) }
}
