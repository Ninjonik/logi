import {
    assignmentAfterDecision,
    mercenaryCategoryFor,
    type ApplicationOutcome,
    type DecisionCategory,
    type AssignmentType,
} from "../../domain/membership/application-decision"

/** All ports must share the caller's transaction. */
export async function commitApplicationDecision(
    ports: {
        upsert(input: {
            assignmentId?: string
            gameId: string
            type: AssignmentType
            status: "pending" | "recruit" | "active"
            categoryId: string
        }): Promise<string>
        remove(id: string): Promise<void>
        close(input: { assignmentId?: string; gameId: string }): Promise<void>
    },
    input: {
        outcome: ApplicationOutcome
        application: { categoryId: string; gameId?: string; games?: string[] }
        assignment: {
            id: string
            type: AssignmentType
            membershipCategoryId?: string
        } | null
        assignments: Array<{ id: string; gameId?: string }>
        categories: DecisionCategory[]
        categoryType: AssignmentType
    }
) {
    const mercenary = mercenaryCategoryFor(input.categories, input.application)
    if (input.outcome === "mercenary" && !mercenary)
        throw new Error("Mercenary category not configured.")
    const change = assignmentAfterDecision(
        input.outcome,
        input.assignment?.type ?? input.categoryType,
        mercenary
    )
    const originalGame = input.application.gameId ?? "hell_let_loose"
    let gameId = originalGame
    let assignmentId = input.assignment?.id
    if (change.kind === "remove") {
        if (assignmentId) await ports.remove(assignmentId)
        assignmentId = undefined
    } else {
        gameId = change.category?.gameId ?? originalGame
        const moved = gameId !== originalGame
        assignmentId = await ports.upsert({
            assignmentId: moved
                ? input.assignments.find(
                      (row) => (row.gameId ?? "hell_let_loose") === gameId
                  )?.id
                : assignmentId,
            gameId,
            type: change.type,
            status: change.status,
            categoryId:
                change.category?.id ??
                input.assignment?.membershipCategoryId ??
                input.application.categoryId,
        })
        if (moved && input.assignment) await ports.remove(input.assignment.id)
    }
    await ports.close({ assignmentId, gameId })
    return { assignmentId: assignmentId ?? null, gameId }
}
