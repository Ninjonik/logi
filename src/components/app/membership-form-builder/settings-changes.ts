import { formChangeCount } from "@/domain/membership/application-form-editing"
import type { ApplicationForm } from "@/domain/membership/application-form"
import type { MembershipSettings } from "@/types/domain"

/**
 * "2 neuložené změny" (N4-44): each changed setting, category, score and
 * question counts once.
 */

export type MembershipDraft = {
    settings: MembershipSettings
    /** The form as the builder edits it (the default form until saved). */
    form: ApplicationForm
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function membershipChangeCount(
    before: MembershipDraft,
    after: MembershipDraft
): number {
    let changes = formChangeCount(before.form, after.form)
    const skip = new Set([
        "categories",
        "applicationForm",
        "rosterScoreSettings",
    ])
    const keys = new Set([
        ...Object.keys(before.settings),
        ...Object.keys(after.settings),
    ])
    for (const key of keys) {
        if (skip.has(key)) continue
        const a = before.settings[key as keyof MembershipSettings]
        const b = after.settings[key as keyof MembershipSettings]
        // An empty text and a missing one are the same setting.
        if ((a ?? "") === (b ?? "")) continue
        if (!same(a, b)) changes += 1
    }
    const scores = new Set([
        ...Object.keys(before.settings.rosterScoreSettings ?? {}),
        ...Object.keys(after.settings.rosterScoreSettings ?? {}),
    ])
    for (const key of scores) {
        const field = key as keyof NonNullable<
            MembershipSettings["rosterScoreSettings"]
        >
        if (
            (before.settings.rosterScoreSettings?.[field] ?? 0) !==
            (after.settings.rosterScoreSettings?.[field] ?? 0)
        )
            changes += 1
    }
    const categories = new Map(
        before.settings.categories.map((category) => [category.id, category])
    )
    for (const category of after.settings.categories) {
        const previous = categories.get(category.id)
        if (!previous || !same(previous, category)) changes += 1
        categories.delete(category.id)
    }
    changes += categories.size
    const order = (settings: MembershipSettings) =>
        settings.categories.map((category) => category.id).join(",")
    if (changes === 0 && order(before.settings) !== order(after.settings))
        changes = 1
    return changes
}
