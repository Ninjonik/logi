import {
    assignmentAfterDecision,
    decisionRoles,
    type ApplicationOutcome,
    type AssignmentAfterDecision,
    type AssignmentStatus,
    type AssignmentType,
    type DecisionRolePolicy,
    type DecisionRoles,
} from "../../domain/membership/application-decision"

/**
 * One decision on an application (L6-B08, L4-B04, M3-B07), the same for the
 * card's buttons and `/close_application`: claim the application so two
 * recruiters cannot decide at once, write the membership (Logi then queues
 * the roles), close the record, show the decision in the thread, DM the
 * applicant and lock the thread. The thread and DM steps are best effort:
 * the decision stands even when Discord refuses them.
 */

export type DecideApplicationPorts = {
    claim(): Promise<"ok" | "closed" | "busy" | "missing">
    release(): Promise<void>
    writeAssignment(change: AssignmentAfterDecision): Promise<void>
    close(): Promise<void>
    showDecision(roles: DecisionRoles): Promise<void>
    /**
     * The decision DM: "sent" when it arrived, "failed" when Discord refused
     * it, "off" when the clan switched decision DMs off (N1-39).
     */
    sendDm(roles: DecisionRoles): Promise<DecisionDm>
    finishThread(): Promise<void>
    report(step: "card" | "dm" | "thread", error: unknown): void
}

export type DecideApplicationInput = {
    outcome: ApplicationOutcome
    categoryType: AssignmentType
    /** The membership status before the decision; null without a membership. */
    before: AssignmentStatus | null
    policy: DecisionRolePolicy
}

export type DecisionDm = "sent" | "failed" | "off"

export type DecideApplicationResult =
    | { status: "decided"; roles: DecisionRoles; dm: DecisionDm }
    | { status: "closed" | "busy" | "missing" }

export async function decideApplication(
    ports: DecideApplicationPorts,
    input: DecideApplicationInput
): Promise<DecideApplicationResult> {
    const claim = await ports.claim()
    if (claim !== "ok") return { status: claim }
    try {
        await ports.writeAssignment(
            assignmentAfterDecision(input.outcome, input.categoryType)
        )
        await ports.close()
    } catch (error) {
        await ports.release().catch(() => undefined)
        throw error
    }
    const roles = decisionRoles(
        input.policy,
        input.before,
        input.outcome,
        input.categoryType
    )
    try {
        await ports.showDecision(roles)
    } catch (error) {
        ports.report("card", error)
    }
    let dm: DecisionDm = "failed"
    try {
        dm = await ports.sendDm(roles)
    } catch (error) {
        ports.report("dm", error)
    }
    try {
        await ports.finishThread()
    } catch (error) {
        ports.report("thread", error)
    }
    return { status: "decided", roles, dm }
}
