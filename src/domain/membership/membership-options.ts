/**
 * Membership switches that used to share one setting (design F1). Each has a
 * legacy fallback so settings saved before the switch existed keep working.
 */
type Settings = {
    enabled: boolean
    roleSyncEnabled?: boolean
    autoAssignRecruitOnApply: boolean
}
type Category = {
    assignmentType: "member" | "reserve_member" | "mercenary"
    autoAssignRecruitOnApply?: boolean
}

/**
 * Whether Logi adds and removes membership roles. Without the separate switch
 * it follows applications, as it always did.
 */
export function syncsMembershipRoles(settings: Settings | undefined): boolean {
    if (!settings) return false
    return settings.roleSyncEnabled ?? settings.enabled
}

/**
 * Whether an applicant of this category skips "pending" and becomes a recruit
 * at once. Only main members can; a category without its own switch uses the
 * clan-wide one.
 */
export function skipsPendingOnApply(
    settings: Pick<Settings, "autoAssignRecruitOnApply"> | undefined,
    category: Category | undefined
): boolean {
    if (!settings || !category || category.assignmentType !== "member")
        return false
    return (
        category.autoAssignRecruitOnApply ?? settings.autoAssignRecruitOnApply
    )
}
