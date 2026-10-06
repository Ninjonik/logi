/**
 * "Zvát mě na seed" (P5-05, P5-21, P5-B03): a member turns the opt-in Seed
 * role on or off themselves. Like the managed member roles, the decision is
 * made on a fresh observation of the member, the change is one Discord write,
 * and the result is confirmed by observing again, so a double click or a role
 * removed by hand in Discord never ends in the wrong reply.
 */

export type SeedRoleToggleOutcome =
    | { kind: "on" }
    | { kind: "off" }
    /** No plan offers this role any more (switched off or replaced). */
    | { kind: "unavailable" }
    /** Discord refused or the change did not stick; an admin must look. */
    | { kind: "failed"; error: unknown }

export type SeedRoleTogglePorts = {
    /** Whether a plan of the clan lets players toggle this role. */
    offered(roleId: string): Promise<boolean>
    /** The member's current roles, read fresh from Discord. */
    observe(): Promise<{ roleIds: readonly string[] }>
    change(action: "add" | "remove", roleId: string): Promise<void>
}

/** Turns the role on when the member lacks it, otherwise off. */
export function seedRoleToggleAction(
    roleIds: readonly string[],
    roleId: string
): "add" | "remove" {
    return roleIds.includes(roleId) ? "remove" : "add"
}

export async function toggleSeedRole(
    ports: SeedRoleTogglePorts,
    roleId: string
): Promise<SeedRoleToggleOutcome> {
    if (!(await ports.offered(roleId))) return { kind: "unavailable" }
    try {
        const before = await ports.observe()
        const action = seedRoleToggleAction(before.roleIds, roleId)
        await ports.change(action, roleId)
        const after = await ports.observe()
        const has = after.roleIds.includes(roleId)
        if (has !== (action === "add"))
            return {
                kind: "failed",
                error: new Error("The Seed role change did not stick."),
            }
        return { kind: has ? "on" : "off" }
    } catch (error) {
        return { kind: "failed", error }
    }
}
