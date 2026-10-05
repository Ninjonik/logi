import { NextResponse } from "next/server"

import { getServerContextUncached } from "@/lib/read-models/server-context"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { getArticle, removeArticle } from "@/lib/articles"
import { logRouteError } from "@/lib/server-route-errors"

/**
 * Deletes one article of this clan. Only a clan administrator of the signed-in
 * session may delete, and the article must belong to the clan in the URL; the
 * Convex mutation checks the clan again inside its transaction.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ serverId: string; articleId: string }> }
) {
    const { serverId, articleId } = await params
    if (!isDashboardWriteOrigin(request))
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const context = await getServerContextUncached(serverId)
    if (!context?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })

    const article = await getArticle(articleId).catch(() => null)
    if (!article || article.guildId !== serverId)
        return NextResponse.json(
            { error: "Article not found." },
            { status: 404 }
        )

    try {
        await removeArticle(serverId, articleId)
        return NextResponse.json({ ok: true })
    } catch (error) {
        logRouteError("articles.delete", error)
        return NextResponse.json(
            { error: "Unable to delete the article." },
            { status: 400 }
        )
    }
}
