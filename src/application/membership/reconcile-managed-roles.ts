import { planManagedRoleChanges } from "../../domain/membership/managed-roles"

export type ManagedRoleOutcome =
    "applied" | "retry_scheduled" | "denied" | "superseded"
/**
 * What an admin needs to fix a denied change (board L5-14): the managed
 * role the bot could not manage and Discord's error code, when it gave one.
 */
export type ManagedRoleFailureDetail = {
    roleId?: string
    discordCode?: number
}
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
        retryAfterMs?: number,
        detail?: ManagedRoleFailureDetail
    ): Promise<boolean>
}
export class ManagedRoleFailure extends Error {
    constructor(
        public readonly category: string,
        public readonly retryAfterMs?: number,
        public readonly denied = false,
        /** Discord's JSON error code (50013), when it answered with one. */
        public readonly discordCode?: number
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
        retryAfterMs?: number,
        detail?: ManagedRoleFailureDetail
    ) =>
        (await ports.finish(status, reason, retryAfterMs, detail))
            ? status
            : ("superseded" as const)
    // The role the current Discord call changes, for a refused change.
    let changing: string | undefined
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
            const unmanageable = current.allowedRoleIds.filter(
                (id) => !observed.manageableRoleIds.includes(id)
            )
            if (unmanageable.length)
                // Name the role this member is about, else the first one.
                return finish(
                    "denied",
                    "role_unmanageable_or_deleted",
                    undefined,
                    {
                        roleId:
                            unmanageable.find(
                                (id) =>
                                    current.desiredRoleIds.includes(id) ||
                                    observed.roleIds.includes(id)
                            ) ?? unmanageable[0],
                    }
                )
            const plan = planManagedRoleChanges({
                observedRoleIds: observed.roleIds,
                desiredManagedRoleIds: current.desiredRoleIds,
                allowedManagedRoleIds: current.allowedRoleIds,
            })
            if (!plan.remove.length && !plan.add.length)
                return finish("applied", "verified")
            if (ports.now() >= deadline || step === 20)
                return finish("retry_scheduled", "work_budget")
            if (plan.remove.length) {
                changing = plan.remove[0]
                await ports.change("remove", plan.remove[0])
            } else {
                changing = plan.add[0]
                await ports.change("add", plan.add[0])
            }
            changing = undefined
        }
    } catch (error) {
        return finish(
            error instanceof ManagedRoleFailure && error.denied
                ? "denied"
                : "retry_scheduled",
            error instanceof ManagedRoleFailure
                ? error.category
                : "provider_unavailable",
            error instanceof ManagedRoleFailure
                ? error.retryAfterMs
                : undefined,
            error instanceof ManagedRoleFailure && error.denied
                ? { roleId: changing, discordCode: error.discordCode }
                : undefined
        )
    }
    return finish("retry_scheduled", "work_budget")
}
