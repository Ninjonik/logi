export type WorkspaceMembership = {
    serverId: string
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
}

/** Returns the first full clan membership suitable as a dashboard workspace. */
export function getDefaultWorkspaceFromMemberships(
    memberships: WorkspaceMembership[]
) {
    return memberships.find(
        (membership) =>
            (membership.type === "member" ||
                membership.type === "reserve_member") &&
            membership.status !== "pending"
    )?.serverId
}
