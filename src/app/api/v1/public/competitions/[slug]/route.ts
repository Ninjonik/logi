import {
    getNamedCollection,
    isCollectionQueryError,
    parseCollectionQuery,
} from "@/lib/api/collection-query"
import {
    filterCollection,
    paginateCollection,
} from "@/domain/shared/collection-query"
import { getPublicCompetition } from "@/lib/read-models/competitions"
import { checkPublicApiRateLimit } from "@/lib/public-api"
import { NextResponse } from "next/server"

function clientBucket(request: Request) {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    )
}
export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const limit = await checkPublicApiRateLimit(
        `public:${clientBucket(request)}`,
        60
    )
    if (!limit.allowed)
        return NextResponse.json(
            { error: { code: "rate_limited", message: "Too many requests." } },
            {
                status: 429,
                headers: {
                    "Retry-After": String(
                        Math.max(
                            1,
                            Math.ceil((limit.resetAt - Date.now()) / 1000)
                        )
                    ),
                },
            }
        )
    const { slug } = await params
    const data = await getPublicCompetition(slug)
    if (!data)
        return NextResponse.json(
            { error: { code: "not_found", message: "Competition not found." } },
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
        collection === "divisions"
            ? getNamedCollection(data, ["divisions"])
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
