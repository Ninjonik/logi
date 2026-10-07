import { publicInviteInputSchema } from "@/domain/workspaces/public-clan-page"
import { readBoundedJson } from "@/lib/api/request-json"

const MAX_BODY_BYTES = 2 * 1024

export type SavePublicInviteResult =
    | { ok: true; inviteUrl: string | null; guildDiscordId: string }
    | { ok: false; error: "invalid_invite" }

const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

/**
 * `PUT /api/servers/[serverId]/public-invite`: a clan admin sets or removes
 * the Discord invite on the clan's public page. The origin and admin check
 * runs before the body is read; the body is a strict `{ inviteUrl }`.
 */
export function createPublicInviteHandler(deps: {
    denied: (request: Request, serverId: string) => Promise<Response | null>
    save: (
        serverId: string,
        inviteUrl: string | null
    ) => Promise<SavePublicInviteResult>
    revalidate: (serverId: string, guildDiscordId: string) => void
    logError: (error: unknown) => void
}) {
    return async function handlePublicInvite(
        request: Request,
        serverId: string
    ) {
        const denied = await deps.denied(request, serverId)
        if (denied) return denied
        const parsed = publicInviteInputSchema.safeParse(
            await readBoundedJson(request, MAX_BODY_BYTES)
        )
        if (!parsed.success) return json({ error: "invalid_invite" }, 400)
        try {
            const result = await deps.save(serverId, parsed.data.inviteUrl)
            if (!result.ok) return json({ error: result.error }, 400)
            deps.revalidate(serverId, result.guildDiscordId)
            return json({ inviteUrl: result.inviteUrl })
        } catch (error) {
            deps.logError(error)
            return json({ error: "save_failed" }, 503)
        }
    }
}
