export function buildMembershipApplicationWelcomeContent(input: {
    welcomeMessage?: string
    applicantId: string
    supportRoleIds: string[]
    categoryLabel: string
}) {
    const applicant = `<@${input.applicantId}>`
    const supportRoles = input.supportRoleIds
        .map((roleId) => `<@&${roleId}>`)
        .join(" ")
    const welcome = Object.entries({
        applicant,
        support_roles: supportRoles,
        category: input.categoryLabel,
    }).reduce(
        (message, [key, value]) => message.split(`{${key}}`).join(value),
        input.welcomeMessage?.trim() ?? ""
    )

    return [applicant, supportRoles, welcome]
        .filter(Boolean)
        .join("\n")
        .slice(0, 2000)
}
