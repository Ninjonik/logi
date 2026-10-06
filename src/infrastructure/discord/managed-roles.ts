import { ManagedRoleFailure } from "../../application/membership/reconcile-managed-roles"
import { z } from "zod"

const snowflake = z.string().regex(/^\d{17,20}$/)
const roleSchema = z.object({
    id: snowflake,
    permissions: z.string().regex(/^\d+$/),
    position: z.number().int().nonnegative(),
    managed: z.boolean(),
})
const guildSchema = z.object({
    id: snowflake,
    owner_id: snowflake,
    roles: z.array(roleSchema).max(1000),
})
const memberSchema = z.object({
    user: z.object({ id: snowflake, bot: z.boolean().optional() }),
    roles: z.array(snowflake).max(250),
    pending: z.boolean().optional(),
})
export type RoleEvidence = {
    actorPresent: boolean
    actorAdministrator: boolean
    actorRoleIds: string[]
    targetRoleIds: string[]
    observedAt: number
}
export type RoleSnapshot = {
    roleIds: string[]
    manageableRoleIds: string[]
    targetEligible: boolean
    evidence: RoleEvidence
}

export function createManagedRoleDiscord(input: {
    token: string
    guildId: string
    userId: string
    actorId: string
    botUserId: string
    operationId: string
    fetch?: typeof fetch
    now?: () => number
}) {
    for (const id of [
        input.guildId,
        input.userId,
        input.actorId,
        input.botUserId,
    ])
        snowflake.parse(id)
    const request = async (path: string, method?: "PUT" | "DELETE") => {
        const response = await (input.fetch ?? fetch)(
            `https://discord.com/api/v10${path}`,
            {
                method,
                headers: {
                    Authorization: `Bot ${input.token}`,
                    ...(method
                        ? {
                              "X-Audit-Log-Reason": encodeURIComponent(
                                  `Logi role operation ${input.operationId}; actor ${input.actorId}`
                              ).slice(0, 512),
                          }
                        : {}),
                },
                redirect: "error",
                cache: "no-store",
                signal: AbortSignal.timeout(5000),
            }
        )
        if (response.status === 204 && method) return null
        const reader = response.body?.getReader()
        if (!reader) throw new ManagedRoleFailure("provider_unavailable")
        const chunks: Uint8Array[] = []
        let length = 0
        try {
            while (true) {
                const next = await reader.read()
                if (next.done) break
                length += next.value.byteLength
                if (length > 512 * 1024) {
                    await reader.cancel()
                    throw new ManagedRoleFailure("provider_response_too_large")
                }
                chunks.push(next.value)
            }
        } finally {
            reader.releaseLock()
        }
        const bytes = new Uint8Array(length)
        let offset = 0
        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.length
        }
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
        const error = z
            .object({
                code: z.number().optional(),
                retry_after: z.number().optional(),
            })
            .safeParse(body)
        if (response.status === 429) {
            const seconds = error.success
                ? (error.data.retry_after ??
                  Number(response.headers.get("retry-after")))
                : 60
            throw new ManagedRoleFailure(
                "rate_limited",
                Number.isFinite(seconds) && seconds > 0
                    ? Math.min(86_400_000, Math.ceil(seconds * 1000))
                    : 60_000
            )
        }
        if (
            response.status === 404 &&
            error.success &&
            error.data.code === 10007
        )
            return null
        if (response.status === 403 || response.status === 401)
            throw new ManagedRoleFailure(
                "discord_forbidden",
                undefined,
                true,
                error.success ? error.data.code : undefined
            )
        if (!response.ok) throw new ManagedRoleFailure("provider_unavailable")
        return body
    }
    const observe = async (): Promise<RoleSnapshot> => {
        const observedAt = (input.now ?? Date.now)()
        const ids = [...new Set([input.userId, input.actorId, input.botUserId])]
        const [guildBody, ...memberBodies] = await Promise.all([
            request(`/guilds/${input.guildId}`),
            ...ids.map((id) =>
                request(`/guilds/${input.guildId}/members/${id}`)
            ),
        ])
        const guild = guildSchema.parse(guildBody)
        if (guild.id !== input.guildId)
            throw new ManagedRoleFailure("provider_identity_mismatch")
        const members = new Map(
            ids.map((id, i) => {
                const member =
                    memberBodies[i] === null
                        ? null
                        : memberSchema.parse(memberBodies[i])
                if (member && member.user.id !== id)
                    throw new ManagedRoleFailure("provider_identity_mismatch")
                return [id, member] as const
            })
        )
        const actor = members.get(input.actorId),
            target = members.get(input.userId),
            bot = members.get(input.botUserId)
        const permissions = (roles: string[]) =>
            guild.roles
                .filter(
                    (role) =>
                        role.id === input.guildId || roles.includes(role.id)
                )
                .reduce(
                    (bits, role) => bits | BigInt(role.permissions),
                    BigInt(0)
                )
        const actorPermissions = permissions(actor?.roles ?? []),
            botPermissions = permissions(bot?.roles ?? [])
        const highest = (roles: string[]) =>
            Math.max(
                0,
                ...guild.roles
                    .filter((role) => roles.includes(role.id))
                    .map((role) => role.position)
            )
        const canManage = Boolean(bot && botPermissions & BigInt(268435464))
        return {
            roleIds: target?.roles ?? [],
            manageableRoleIds: canManage
                ? guild.roles
                      .filter(
                          (role) =>
                              role.id !== input.guildId &&
                              !role.managed &&
                              role.position < highest(bot!.roles)
                      )
                      .map((role) => role.id)
                : [],
            targetEligible: Boolean(
                target &&
                !target.pending &&
                !target.user.bot &&
                input.userId !== guild.owner_id &&
                highest(target.roles) < highest(bot?.roles ?? [])
            ),
            evidence: {
                actorPresent: Boolean(actor && !actor.pending),
                actorAdministrator:
                    input.actorId === guild.owner_id ||
                    Boolean(actorPermissions & BigInt(8)),
                actorRoleIds: actor?.roles ?? [],
                targetRoleIds: target?.roles ?? [],
                observedAt,
            },
        }
    }
    return {
        observe,
        change: async (action: "add" | "remove", roleId: string) => {
            snowflake.parse(roleId)
            await request(
                `/guilds/${input.guildId}/members/${input.userId}/roles/${roleId}`,
                action === "add" ? "PUT" : "DELETE"
            )
        },
    }
}
