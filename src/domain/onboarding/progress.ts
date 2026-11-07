import type { OnboardingState } from "./tours"

export type OnboardingMilestone =
    "dashboard_setup" | "workspace_tour" | "player_import"

/** Account guidance is scoped to the selected workspace and never grants access. */
export function completeOnboardingMilestone(
    current: OnboardingState,
    milestone: OnboardingMilestone,
    workspaceId: string | undefined,
    completedAt: string
): OnboardingState {
    if (milestone === "dashboard_setup")
        return { ...current, dashboardSetupCompletedAt: completedAt }
    if (!workspaceId) throw new Error("A workspace is required.")
    const field =
        milestone === "player_import"
            ? "playerImportsCompletedAt"
            : "workspaceTourCompletedAt"
    return {
        ...current,
        [field]: { ...current[field], [workspaceId]: completedAt },
    }
}
