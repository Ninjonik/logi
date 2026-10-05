/**
 * Sign-up counts for the public match announcement: the total, then one
 * entry per offered group ("Tanky 6/6" when the match caps the group).
 */

export type SignupCountGroup = { id: string; name: string }

export type SignupGroupCount = {
    id: string
    name: string
    count: number
    /** Present only when the match caps this group. */
    max?: number
}

export type SignupCounts = {
    total: number
    groups: SignupGroupCount[]
    /** Attending players without a known group (general sign-up). */
    withoutGroup: number
}

/**
 * Per-group caps of a match. The event field is
 * `signupGroupLimits: Array<{ groupId, max }>`; a `{ [groupId]: max }` map is
 * accepted too. Anything else, and every cap that is not a positive whole
 * number, is ignored, so a missing or malformed field shows plain counts.
 */
export function readSignupGroupLimits(value: unknown): Map<string, number> {
    const limits = new Map<string, number>()
    const add = (groupId: unknown, max: unknown) => {
        if (
            typeof groupId === "string" &&
            groupId.trim() &&
            typeof max === "number" &&
            Number.isInteger(max) &&
            max > 0
        )
            limits.set(groupId.trim(), max)
    }
    if (Array.isArray(value)) {
        for (const entry of value) {
            if (entry && typeof entry === "object")
                add(
                    (entry as { groupId?: unknown }).groupId,
                    (entry as { max?: unknown }).max
                )
        }
    } else if (value && typeof value === "object") {
        for (const [groupId, max] of Object.entries(value)) add(groupId, max)
    }
    return limits
}

/**
 * Counts attending sign-ups per offered group, in the order of `groups`.
 * A sign-up names its group by ID (older events by name); one that matches
 * no offered group counts as "without group".
 */
export function countSignups(input: {
    groups: readonly SignupCountGroup[]
    /** Groups this match offers; null or undefined offers every group. */
    offeredGroupIds?: readonly string[] | null
    /** Attending sign-ups only. */
    signups: ReadonlyArray<{ group?: string | null }>
    limits?: ReadonlyMap<string, number>
}): SignupCounts {
    const offered = input.offeredGroupIds
        ? new Set(input.offeredGroupIds)
        : null
    const groups = input.groups.filter(
        (group) => !offered || offered.has(group.id)
    )
    const counts = new Map(groups.map((group) => [group.id, 0]))
    const idByName = new Map(groups.map((group) => [group.name, group.id]))
    let withoutGroup = 0
    for (const signup of input.signups) {
        const key = signup.group ?? ""
        const id = counts.has(key) ? key : idByName.get(key)
        if (id === undefined) withoutGroup += 1
        else counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return {
        total: input.signups.length,
        groups: groups.map((group) => {
            const max = input.limits?.get(group.id)
            return {
                id: group.id,
                name: group.name,
                count: counts.get(group.id) ?? 0,
                ...(max === undefined ? {} : { max }),
            }
        }),
        withoutGroup,
    }
}

/** "Tanky 6/6" with a cap, "Pěchota 15" without one. */
export function formatGroupCount(group: SignupGroupCount) {
    return group.max === undefined
        ? `${group.name} ${group.count}`
        : `${group.name} ${group.count}/${group.max}`
}
