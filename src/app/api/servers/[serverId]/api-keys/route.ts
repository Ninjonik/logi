import {
    createClanApiKey,
    listClanApiKeys,
    revokeClanApiKey,
} from "@/lib/public-api"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { isApiKeyReadAccess } from "@/domain/api/key-access"
import { readBoundedJson } from "@/lib/api/request-json"

const json = (body: unknown, status = 200) =>
    Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store" },
    })
type Context = { params: Promise<{ serverId: string }> }
async function managementContext(serverId: string) {
    const context = await getServerContextUncached(serverId)
    const actor = await currentDashboardActor()
    return context?.canAdmin && actor
        ? { guildId: context.server.discordId, actor }
        : null
}
const sameOrigin = (request: Request) =>
    request.headers.get("origin") === new URL(request.url).origin

export async function GET(_request: Request, { params }: Context) {
    const context = await managementContext((await params).serverId)
    if (!context) return json({ error: "Forbidden." }, 403)
    try {
        return json({
            keys: await listClanApiKeys(context.guildId, context.actor),
        })
    } catch {
        return json({ error: "API keys unavailable." }, 503)
    }
}
export async function POST(request: Request, { params }: Context) {
    if (!sameOrigin(request)) return json({ error: "Forbidden." }, 403)
    const body = await readBoundedJson(request, 16_384)
    if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "Invalid API key request." }, 400)
    const input = body as { name?: unknown; readAccess?: unknown }
    const name = typeof input.name === "string" ? input.name.trim() : ""
    if (!name || name.length > 80)
        return json({ error: "Enter a key name of up to 80 characters." }, 400)
    if (input.readAccess !== undefined && !isApiKeyReadAccess(input.readAccess))
        return json({ error: "Invalid API key read access." }, 400)
    const context = await managementContext((await params).serverId)
    if (!context) return json({ error: "Forbidden." }, 403)
    try {
        const key = await createClanApiKey(
            context.guildId,
            context.actor,
            name,
            input.readAccess
        )
        return json({ key }, 201)
    } catch {
        return json({ error: "Unable to create API key." }, 503)
    }
}
export async function DELETE(request: Request, { params }: Context) {
    if (!sameOrigin(request)) return json({ error: "Forbidden." }, 403)
    const keyId = new URL(request.url).searchParams.get("keyId")
    if (!keyId) return json({ error: "Missing keyId." }, 400)
    const context = await managementContext((await params).serverId)
    if (!context) return json({ error: "Forbidden." }, 403)
    try {
        await revokeClanApiKey(context.guildId, context.actor, keyId)
        return json({ ok: true })
    } catch {
        return json({ error: "Unable to revoke API key." }, 503)
    }
}
