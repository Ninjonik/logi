/** Names are stored in preference order, independently of a full group's reserve state. */
export function validateSignupPreferences(input: {
    preferences?: string[]
    group: string | null
    enabled?: boolean
    kind?: "match" | "training"
    offeredNames: readonly string[]
}) {
    if (input.preferences === undefined) return undefined
    const choices = input.preferences.map((name) => name.trim())
    if (
        !choices.length ||
        choices.length > 25 ||
        choices.some((name) => !name || !input.offeredNames.includes(name)) ||
        new Set(choices).size !== choices.length ||
        choices[0] !== input.group
    )
        throw new Error(
            "Choose unique offered groups in preference order, starting with group."
        )
    if (choices.length > 1 && (input.kind !== "match" || !input.enabled))
        throw new Error("Backup group choices are not enabled for this match.")
    return choices
}
