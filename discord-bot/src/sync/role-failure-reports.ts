/**
 * Member-role failures an admin must fix (the bot's role is below a managed
 * role, a role was deleted, Discord refused the change) go to the errors
 * channel as one grouped report per clan and role (L5-14), not one per
 * member: the failures of a short window are collected and reported
 * together with the members' IDs, the role and Discord's answer.
 */

/** Role outcomes an admin must fix; the others resolve by themselves. */
export const ADMIN_FIXABLE_ROLE_FAILURES: ReadonlySet<string> = new Set([
    "role_unmanageable_or_deleted",
    "discord_forbidden",
])

export type RoleFailureReport = {
    guildId: string
    /** The managed role the bot could not manage, when known. */
    roleId?: string
    memberIds: string[]
    reasons: string[]
    /** Discord's JSON error code of a refused change, when it gave one. */
    discordCode?: number
}

export type RoleFailureReporterPorts = {
    report(report: RoleFailureReport): Promise<void>
    schedule(run: () => void, delayMs: number): void
}

/**
 * The report as an error the errors channel classifies: Discord's own code,
 * else "missing permission" (50013). With the role, the reporter then tells
 * a role above the Logi role, a deleted role and a missing Manage Roles
 * apart (L5-14, L5-29).
 */
export function roleFailureError(
    report: Pick<RoleFailureReport, "reasons" | "discordCode">
) {
    return Object.assign(new Error(report.reasons.join(", ")), {
        name: "RoleOperationError",
        code: report.discordCode ?? 50013,
    })
}

/** Collects failures per clan and role and reports each once per window. */
export function createRoleFailureReporter(
    ports: RoleFailureReporterPorts,
    windowMs = 60_000
) {
    const pending = new Map<
        string,
        {
            guildId: string
            roleId?: string
            memberIds: Set<string>
            reasons: Set<string>
            discordCode?: number
        }
    >()
    const flush = (key: string) => {
        const entry = pending.get(key)
        pending.delete(key)
        if (!entry?.memberIds.size) return
        void ports
            .report({
                guildId: entry.guildId,
                ...(entry.roleId ? { roleId: entry.roleId } : {}),
                memberIds: [...entry.memberIds],
                reasons: [...entry.reasons],
                ...(entry.discordCode !== undefined
                    ? { discordCode: entry.discordCode }
                    : {}),
            })
            .catch(() => undefined)
    }
    return {
        /** Records one member's failed role change; true when it will be reported. */
        add(input: {
            guildId: string
            memberId: string
            reason: string
            roleId?: string
            discordCode?: number
        }) {
            if (!ADMIN_FIXABLE_ROLE_FAILURES.has(input.reason)) return false
            const key = `${input.guildId}:${input.roleId ?? ""}`
            const entry = pending.get(key)
            if (entry) {
                entry.memberIds.add(input.memberId)
                entry.reasons.add(input.reason)
                entry.discordCode ??= input.discordCode
                return true
            }
            pending.set(key, {
                guildId: input.guildId,
                roleId: input.roleId,
                memberIds: new Set([input.memberId]),
                reasons: new Set([input.reason]),
                discordCode: input.discordCode,
            })
            ports.schedule(() => flush(key), windowMs)
            return true
        },
    }
}
