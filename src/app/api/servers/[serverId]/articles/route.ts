import {
    articleCreateSchema,
    getArticleFieldError,
} from "@/lib/validation/article"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { listArticles, saveArticle } from "@/lib/articles"
import { logRouteError } from "@/lib/server-route-errors"
import { readBoundedJson } from "@/lib/api/request-json"
import { getServerContext } from "@/lib/server-context"
import { NextResponse } from "next/server"
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    const context = await getServerContext(serverId)
    if (!context)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    return NextResponse.json({ data: await listArticles(serverId) })
}
export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    if (!isDashboardWriteOrigin(request))
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const context = await getServerContextUncached(serverId)
    if (!context?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const parsed = articleCreateSchema.safeParse(
        await readBoundedJson(request, 256 * 1024)
    )
    if (!parsed.success)
        return NextResponse.json(
            {
                error: "The article is incomplete or too long.",
                field: getArticleFieldError(parsed.error),
            },
            { status: 400 }
        )
    try {
        const id = await saveArticle({
            guildId: serverId,
            authorId: context.user.discordId,
            ...parsed.data,
        })
        return NextResponse.json({ id: String(id) }, { status: 201 })
    } catch (error) {
        logRouteError("articles.create", error)
        return NextResponse.json(
            { error: "Unable to save article." },
            { status: 400 }
        )
    }
}
