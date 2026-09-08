import {
    getNamedCollection,
    isCollectionQueryError,
    parseCollectionQuery,
} from "@/lib/api/collection-query"
import {
    filterCollection,
    paginateCollection,
} from "@/domain/shared/collection-query"
import { getPublicClan } from "@/lib/read-models/public-profiles"
import { checkPublicApiRateLimit } from "@/lib/public-api"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clanId: string }> }
) {
    const rateLimit = await checkPublicApiRateLimit(
        `public:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`,
        60
    )
    if (!rateLimit.allowed)
        return NextResponse.json(
            { error: { code: "rate_limited", message: "Too many requests." } },
            { status: 429 }
        )
    const { clanId } = await params
    const data = await getPublicClan(clanId)
    if (!data)
        return NextResponse.json(
            { error: { code: "not_found", message: "Clan not found." } },
            { status: 404 }
        )
    const collection = new URL(request.url).searchParams.get("collection")
    if (!collection)
        return NextResponse.json(
            { data },
            { headers: { "Cache-Control": "public, max-age=60" } }
        )
    const query = parseCollectionQuery(request)
    if (isCollectionQueryError(query))
        return NextResponse.json(
            { error: { code: "invalid_query", message: query.error } },
            { status: 400 }
        )
    const items =
        collection === "recentMatches"
            ? getNamedCollection(data, ["recentMatches"])
            : null
    if (!items)
        return NextResponse.json(
            { error: { code: "not_found", message: "Collection not found." } },
            { status: 404 }
        )
    return NextResponse.json(
        {
            data: paginateCollection(
                filterCollection(items, query.filters),
                query.offset,
                query.limit
            ),
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
    )
}
