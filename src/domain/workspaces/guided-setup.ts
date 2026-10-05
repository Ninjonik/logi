import {
    SETTINGS_SETUP_STEPS,
    type SettingsSetupStep,
    type SettingsSetupStepId,
} from "./settings-overview"

/**
 * Where the setup guide stands (design B): one of the six steps, or the
 * closing "Logi is ready" screen after the last one.
 */
export type GuidedSetupPosition = SettingsSetupStepId | "done"

export function isGuidedSetupPosition(
    value: unknown
): value is GuidedSetupPosition {
    return (
        value === "done" || SETTINGS_SETUP_STEPS.some((step) => step === value)
    )
}

/**
 * The `?step=` address of the guide: a step ID such as `channels` (any
 * letter case), or `done`. Anything else, a repeated parameter included, is
 * no position.
 */
export function parseGuidedSetupStep(
    value: string | readonly string[] | null | undefined
): GuidedSetupPosition | undefined {
    if (typeof value !== "string") return undefined
    const wanted = value.trim().toLowerCase()
    if (wanted === "done") return "done"
    return SETTINGS_SETUP_STEPS.find((step) => step.toLowerCase() === wanted)
}

/** The first step the stored settings do not finish, or the closing screen when all are done. */
export function firstUnfinishedGuidedStep(
    steps: readonly SettingsSetupStep[]
): GuidedSetupPosition {
    return steps.find((step) => step.state !== "done")?.id ?? "done"
}

/** The step the guide opens on: the one in the address, else the first unfinished one. */
export function openingGuidedSetupStep(
    param: string | readonly string[] | null | undefined,
    steps: readonly SettingsSetupStep[]
): GuidedSetupPosition {
    return parseGuidedSetupStep(param) ?? firstUnfinishedGuidedStep(steps)
}

/**
 * How the step list marks a step: the open step is `current` even when it is
 * already finished, so a reopened step shows its number; any other finished
 * step shows a check.
 */
export type GuidedSetupMarker = "current" | "done" | "todo"

export type GuidedSetupItem = {
    id: SettingsSetupStepId
    /** 1-based, as in "Step 4 of 6". */
    number: number
    optional: boolean
    marker: GuidedSetupMarker
}

/**
 * Everything the guide shows around the open step. Completion comes from the
 * same rule as the settings overview (`settingsSetupSteps`), so both always
 * agree; the position only decides which step is open.
 */
export function guidedSetupView(
    steps: readonly SettingsSetupStep[],
    position: GuidedSetupPosition
) {
    const index = steps.findIndex((step) => step.id === position)
    const current = index === -1 ? undefined : steps[index]
    const items: GuidedSetupItem[] = steps.map((step, stepIndex) => ({
        id: step.id,
        number: stepIndex + 1,
        optional: step.optional,
        marker:
            step.id === position
                ? "current"
                : step.state === "done"
                  ? "done"
                  : "todo",
    }))
    return {
        items,
        total: steps.length,
        done: steps.filter((step) => step.state === "done").length,
        /** The open step, or undefined on the closing screen. */
        current: current
            ? {
                  ...current,
                  number: index + 1,
                  last: index === steps.length - 1,
              }
            : undefined,
        /** Where "Back" leads; none on the first step and the closing screen. */
        previous: index > 0 ? steps[index - 1]?.id : undefined,
        /** Where "Continue" and "Skip" lead: the following step, or the closing screen after the last. */
        next:
            index === -1
                ? undefined
                : (steps[index + 1]?.id ?? ("done" as const)),
    }
}
