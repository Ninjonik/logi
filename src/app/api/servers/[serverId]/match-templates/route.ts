import { matchTemplatesSaveSchema } from "@/lib/validation/match-templates"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { saveMatchTemplates } from "@/lib/server-match-templates"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"
import { logRouteError } from "@/lib/server-route-errors"
import { readBoundedJson } from "@/lib/api/request-json"

const MAX_BODY_BYTES = 64 * 1024

const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

/** Saves the clan's full list of match templates (settings › Match templates). */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    const denied = await clanAdminWriteDenied(request, serverId)
    if (denied) return denied
    const parsed = matchTemplatesSaveSchema.safeParse(
        await readBoundedJson(request, MAX_BODY_BYTES)
    )
    if (!parsed.success) return json({ error: "invalid_templates" }, 400)
    try {
        const result = await saveMatchTemplates(serverId, parsed.data.templates)
        if (!result.ok) return json(result, 400)
        revalidateCacheEntries([
            appCacheTags.server(serverId),
            appCacheTags.serverContext(serverId),
        ])
        return json(result)
    } catch (error) {
        logRouteError("matchTemplates.save", error)
        return json({ error: "save_failed" }, 503)
    }
}
