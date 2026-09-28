import { z } from "zod"
type Ports = {
    authorize(serverId: string): Promise<string | null>
    list(guildId: string): Promise<unknown>
    configure(
        guildId: string,
        value: { sourceRef: string; enabled: boolean }
    ): Promise<unknown>
}
const configuration = z.strictObject({
    sourceRef: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    enabled: z.boolean(),
})
const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
export function gameDataHandlers(ports: Ports) {
    return {
        GET: async (_request: Request, server: string) => {
            const guild = await ports.authorize(server)
            if (!guild) return json({ error: "Forbidden." }, 403)
            try {
                return json(await ports.list(guild))
            } catch {
                return json(
                    { error: "Game data configuration unavailable." },
                    503
                )
            }
        },
        POST: async (request: Request, server: string) => {
            const guild = await ports.authorize(server)
            if (!guild) return json({ error: "Forbidden." }, 403)
            const origin = request.headers.get("origin")
            if (origin && origin !== new URL(request.url).origin)
                return json({ error: "Forbidden." }, 403)
            const body = await request.text()
            let input: unknown
            try {
                input = body.length <= 2048 ? JSON.parse(body) : null
            } catch {
                input = null
            }
            const parsed = configuration.safeParse(input)
            if (!parsed.success)
                return json({ error: "Invalid source configuration." }, 400)
            try {
                await ports.configure(guild, parsed.data)
                return json({ ok: true })
            } catch {
                return json(
                    { error: "Unable to update the configured source." },
                    400
                )
            }
        },
    }
}
