/**
 * Member-role failures an admin must fix (the bot's role is below a managed
 * role, a role was deleted, Discord refused the change) go to the errors
 * channel as one grouped report per clan (L5-14), not one per member: the
 * failures of a short window are collected and reported together with the
 * members' IDs.
 */

/** Role outcomes an admin must fix; the others resolve by themselves. */
export const ADMIN_FIXABLE_ROLE_FAILURES: ReadonlySet<string> = new Set([
    "role_unmanageable_or_deleted",
    "discord_forbidden",
])

export type RoleFailureReport = {
    guildId: string
    memberIds: string[]
    reasons: string[]
}

export type RoleFailureReporterPorts = {
    report(report: RoleFailureReport): Promise<void>
    schedule(run: () => void, delayMs: number): void
}

/** Collects failures per clan and reports each clan once per window. */
export function createRoleFailureReporter(
    ports: RoleFailureReporterPorts,
    windowMs = 60_000
) {
    const pending = new Map<
        string,
        { memberIds: Set<string>; reasons: Set<string> }
    >()
    const flush = (guildId: string) => {
        const entry = pending.get(guildId)
        pending.delete(guildId)
        if (!entry?.memberIds.size) return
        void ports
            .report({
                guildId,
                memberIds: [...entry.memberIds],
                reasons: [...entry.reasons],
            })
            .catch(() => undefined)
    }
    return {
        /** Records one member's failed role change; true when it will be reported. */
        add(input: { guildId: string; memberId: string; reason: string }) {
            if (!ADMIN_FIXABLE_ROLE_FAILURES.has(input.reason)) return false
            const entry = pending.get(input.guildId)
            if (entry) {
                entry.memberIds.add(input.memberId)
                entry.reasons.add(input.reason)
                return true
            }
            pending.set(input.guildId, {
                memberIds: new Set([input.memberId]),
                reasons: new Set([input.reason]),
            })
            ports.schedule(() => flush(input.guildId), windowMs)
            return true
        },
    }
}
