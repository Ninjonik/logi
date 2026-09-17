export type WorkspaceMembership = {
    serverId: string
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
}

/** Returns full clan memberships in their dashboard-selection order. */
export function getDefaultWorkspaceCandidatesFromMemberships(
    memberships: WorkspaceMembership[]
) {
    return [
        ...new Set(
            memberships
                .filter(
                    (membership) =>
                        (membership.type === "member" ||
                            membership.type === "reserve_member") &&
                        membership.status !== "pending"
                )
                .map((membership) => membership.serverId)
        ),
    ]
}

/** Returns the first full clan membership suitable as a dashboard workspace. */
export function getDefaultWorkspaceFromMemberships(
    memberships: WorkspaceMembership[]
) {
    return getDefaultWorkspaceCandidatesFromMemberships(memberships)[0]
}
