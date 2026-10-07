/**
 * The intro of an application thread (L6-42, L4-26, N4-34, N4-38): the
 * applicant and, when the clan wants it, the category's support roles on
 * the first line, then the welcome text with `{applicant}`,
 * `{support_roles}` and `{category}` filled in. Without the clan's own
 * welcome the clan-language default greets the applicant.
 */
export function buildMembershipApplicationWelcomeContent(input: {
    welcomeMessage?: string
    applicantId: string
    supportRoleIds: string[]
    categoryLabel: string
    /** The clan-language default when no welcome is set. */
    defaultWelcome?: { withRoles: string; withoutRoles: string }
    /** "Označit role podpory kategorie ve vlákně" (N4-34); on by default. */
    mentionSupportRoles?: boolean
}) {
    const applicant = `<@${input.applicantId}>`
    const supportRoles = input.supportRoleIds
        .map((roleId) => `<@&${roleId}>`)
        .join(" ")
    const template =
        input.welcomeMessage?.trim() ||
        (input.defaultWelcome
            ? supportRoles
                ? input.defaultWelcome.withRoles
                : input.defaultWelcome.withoutRoles
            : "")
    const welcome = Object.entries({
        applicant,
        support_roles: supportRoles,
        category: input.categoryLabel,
    }).reduce(
        (message, [key, value]) => message.split(`{${key}}`).join(value),
        template
    )
    const pings = [
        applicant,
        ...(input.mentionSupportRoles === false || !supportRoles
            ? []
            : [supportRoles]),
    ].join(" ")

    return [pings, welcome].filter(Boolean).join("\n").slice(0, 2000)
}
