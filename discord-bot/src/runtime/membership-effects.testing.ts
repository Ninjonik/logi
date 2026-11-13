import type { MembershipEffectPort } from "./membership-effects"

/** Fake journal for interaction rendering tests; recovery semantics have separate tests. */
export function immediateMembershipEffects(): MembershipEffectPort {
    return {
        skip: async () => ({ state: "skipped" }),
        effect: async (_key, _mode, execute) => ({
            state: "confirmed",
            resourceId: (await execute())?.id,
        }),
        complete: async () => true,
    }
}
