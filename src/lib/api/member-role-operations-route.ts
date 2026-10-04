import { memberRoleOperationsSchema } from "@/domain/membership/role-operations"

type Ports = {
    authorize(serverId: string): Promise<string | null>
    list(guildId: string): Promise<unknown>
}
const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
export function memberRoleOperationsHandler(ports: Ports) {
    return async (_request: Request, serverId: string) => {
        try {
            const guildId = await ports.authorize(serverId)
            if (!guildId) return json({ error: "Forbidden." }, 403)
            const result = memberRoleOperationsSchema.parse(
                await ports.list(guildId)
            )
            if ((await ports.authorize(serverId)) !== guildId)
                return json({ error: "Forbidden." }, 403)
            return json(result)
        } catch {
            return json({ error: "Role operations unavailable." }, 503)
        }
    }
}
