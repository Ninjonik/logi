import {
    membershipPolicyInputSchema,
    type MembershipPolicyInput,
} from "@/domain/membership/policy"
type Ports = {
    authorize(serverId: string): Promise<string | null>
    list(guildId: string): Promise<unknown>
    configure(guildId: string, input: MembershipPolicyInput): Promise<unknown>
}
const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
async function readPolicyBody(request: Request) {
    const reader = request.body?.getReader()
    if (!reader) return null
    const decoder = new TextDecoder()
    let length = 0,
        text = ""
    try {
        while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            length += chunk.value.byteLength
            if (length > 16384) {
                await reader.cancel()
                return null
            }
            text += decoder.decode(chunk.value, { stream: true })
        }
        return JSON.parse(text + decoder.decode()) as unknown
    } catch {
        return null
    } finally {
        reader.releaseLock()
    }
}
export function membershipPolicyHandlers(ports: Ports) {
    return {
        GET: async (_request: Request, serverId: string) => {
            const guildId = await ports.authorize(serverId)
            if (!guildId) return json({ error: "Forbidden." }, 403)
            try {
                return json(await ports.list(guildId))
            } catch {
                return json({ error: "Membership policies unavailable." }, 503)
            }
        },
        POST: async (request: Request, serverId: string) => {
            const guildId = await ports.authorize(serverId)
            if (
                !guildId ||
                request.headers.get("origin") !== new URL(request.url).origin
            )
                return json({ error: "Forbidden." }, 403)
            const parsed = membershipPolicyInputSchema.safeParse(
                await readPolicyBody(request)
            )
            if (!parsed.success)
                return json({ error: "Invalid membership policy." }, 400)
            if ((await ports.authorize(serverId)) !== guildId)
                return json({ error: "Forbidden." }, 403)
            try {
                await ports.configure(guildId, parsed.data)
                return json({ ok: true })
            } catch {
                return json(
                    { error: "Unable to update this membership policy." },
                    400
                )
            }
        },
    }
}
