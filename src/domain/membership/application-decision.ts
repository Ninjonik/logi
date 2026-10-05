/**
 * The recruiters' decision on an application (L6-45..L6-51, L4-33, N4-40,
 * M3-37..43): what the decision does to the membership and which roles Logi
 * will then add or remove. The decision buttons on the thread card and
 * `/close_application` use the same rules.
 */

/** In the order of `/close_application`'s choice list (M3-38). */
export const APPLICATION_OUTCOMES = [
    "member",
    "recruit",
    "mercenary",
    "pending",
    "denied",
] as const
export type ApplicationOutcome = (typeof APPLICATION_OUTCOMES)[number]

/** The outcomes of the accept buttons on the card (L6-45). */
export const ACCEPT_OUTCOMES = ["member", "recruit", "mercenary"] as const

export function isApplicationOutcome(
    value: string | null | undefined
): value is ApplicationOutcome {
    return APPLICATION_OUTCOMES.includes(value as ApplicationOutcome)
}

export type AssignmentType = "member" | "reserve_member" | "mercenary"
export type AssignmentStatus = "pending" | "recruit" | "active"

export type AssignmentAfterDecision =
    | { kind: "remove" }
    | { kind: "upsert"; type: AssignmentType; status: AssignmentStatus }

/**
 * The membership after the decision. "Člen" keeps a reserve category's
 * reserve type; "Žoldák" always makes a mercenary; "Zamítnuto" removes the
 * membership the application created.
 */
export function assignmentAfterDecision(
    outcome: ApplicationOutcome,
    categoryType: AssignmentType
): AssignmentAfterDecision {
    const memberType: AssignmentType =
        categoryType === "mercenary" ? "member" : categoryType
    switch (outcome) {
        case "member":
            return { kind: "upsert", type: memberType, status: "active" }
        case "recruit":
            return { kind: "upsert", type: memberType, status: "recruit" }
        case "mercenary":
            return { kind: "upsert", type: "mercenary", status: "active" }
        case "pending":
            return { kind: "upsert", type: categoryType, status: "pending" }
        case "denied":
            return { kind: "remove" }
    }
}

export type DecisionRolePolicy = {
    /** The clan role every accepted member gets. */
    clanRoleId?: string | null
    /** Whether Logi manages membership roles at all. */
    roleSync: boolean
    category: {
        recruitRoleIds: readonly string[]
        finalRoleIds: readonly string[]
    }
}

/** The roles a membership status gives (pending gives none). */
export function rolesForStatus(
    policy: DecisionRolePolicy,
    status: AssignmentStatus | null
): string[] {
    if (!policy.roleSync || !status || status === "pending") return []
    return [
        ...new Set([
            ...(policy.clanRoleId ? [policy.clanRoleId] : []),
            ...(status === "recruit"
                ? policy.category.recruitRoleIds
                : policy.category.finalRoleIds),
        ]),
    ]
}

export type DecisionRoles = {
    /** Every role the applicant has after the decision ("Role @Klan a @Člen"). */
    after: string[]
    /** Roles newly added by the decision. */
    added: string[]
    /** Roles the decision takes away ("− @Rekrut"). */
    removed: string[]
}

export function decisionRoles(
    policy: DecisionRolePolicy,
    before: AssignmentStatus | null,
    outcome: ApplicationOutcome,
    categoryType: AssignmentType
): DecisionRoles {
    const next = assignmentAfterDecision(outcome, categoryType)
    const after = rolesForStatus(
        policy,
        next.kind === "remove" ? null : next.status
    )
    const previous = rolesForStatus(policy, before)
    return {
        after,
        added: after.filter((role) => !previous.includes(role)),
        removed: previous.filter((role) => !after.includes(role)),
    }
}

export type DecisionTableRow = {
    outcome: ApplicationOutcome
    add: string[]
    remove: string[]
}

/**
 * The decision table of the settings page (N4-40): what each button does to
 * an applicant who already has the recruit role.
 */
export function decisionTable(
    policy: DecisionRolePolicy,
    categoryType: AssignmentType
): DecisionTableRow[] {
    return (["member", "recruit", "mercenary", "denied"] as const).map(
        (outcome) => {
            const roles = decisionRoles(
                policy,
                "recruit",
                outcome,
                categoryType
            )
            return {
                outcome,
                add: roles.after,
                remove: roles.removed,
            }
        }
    )
}
