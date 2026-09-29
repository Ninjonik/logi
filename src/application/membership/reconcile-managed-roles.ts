import { planManagedRoleChanges } from "../../domain/membership/managed-roles"

export type ManagedRoleOutcome =
    "applied" | "retry_scheduled" | "denied" | "superseded"
export type ManagedRolePorts = {
    now(): number
    prepare(): Promise<{
        verdict: "ready" | "denied" | "superseded"
        allowedRoleIds: string[]
        desiredRoleIds: string[]
    }>
    observe(): Promise<{
        roleIds: string[]
        actorAuthorized: boolean
        targetEligible: boolean
        manageableRoleIds: string[]
    }>
    change(action: "add" | "remove", roleId: string): Promise<void>
    finish(
        status: ManagedRoleOutcome,
        reason: string,
        retryAfterMs?: number
    ): Promise<boolean>
}
export class ManagedRoleFailure extends Error {
    constructor(
        public readonly category: string,
        public readonly retryAfterMs?: number,
        public readonly denied = false
    ) {
        super(category)
    }
}

/** Re-read before each idempotent per-role call and confirm actual state before reporting success. */
export async function reconcileManagedRoles(
    ports: ManagedRolePorts
): Promise<ManagedRoleOutcome> {
    const deadline = ports.now() + 15_000
    const finish = async (
        status: ManagedRoleOutcome,
        reason: string,
        retryAfterMs?: number
    ) =>
        (await ports.finish(status, reason, retryAfterMs))
            ? status
            : ("superseded" as const)
    try {
        for (let step = 0; step <= 20; step++) {
            const initial = await ports.prepare()
            if (initial.verdict !== "ready")
                return finish(initial.verdict, "authority_or_state_changed")
            const observed = await ports.observe()
            const current = await ports.prepare()
            if (current.verdict !== "ready")
                return finish(current.verdict, "authority_or_state_changed")
            if (!observed.actorAuthorized)
                return finish("denied", "actor_not_authorized")
            if (!observed.targetEligible)
                return finish("denied", "target_not_eligible")
            if (
                current.allowedRoleIds.some(
                    (id) => !observed.manageableRoleIds.includes(id)
                )
            )
                return finish("denied", "role_unmanageable_or_deleted")
            const plan = planManagedRoleChanges({
                observedRoleIds: observed.roleIds,
                desiredManagedRoleIds: current.desiredRoleIds,
                allowedManagedRoleIds: current.allowedRoleIds,
            })
            if (!plan.remove.length && !plan.add.length)
                return finish("applied", "verified")
            if (ports.now() >= deadline || step === 20)
                return finish("retry_scheduled", "work_budget")
            if (plan.remove.length) await ports.change("remove", plan.remove[0])
            else await ports.change("add", plan.add[0])
        }
    } catch (error) {
        return finish(
            error instanceof ManagedRoleFailure && error.denied
                ? "denied"
                : "retry_scheduled",
            error instanceof ManagedRoleFailure
                ? error.category
                : "provider_unavailable",
            error instanceof ManagedRoleFailure ? error.retryAfterMs : undefined
        )
    }
    return finish("retry_scheduled", "work_budget")
}
