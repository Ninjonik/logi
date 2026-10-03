import { GAME_IDS, type GameId } from "../games/game"

export type RoleActorKind =
    "dashboard" | "recruitment" | "application" | "rollback"
export type RoleActor = { userId: string; kind: RoleActorKind }
type Category = {
    id: string
    recruitRoleIds: string[]
    finalRoleIds: string[]
    supportRoleIds: string[]
}
type Settings = {
    enabled: boolean
    autoAssignRecruitOnApply: boolean
    categories: Category[]
}
export type ManagedRoleConfig = {
    clanRoleId?: string
    dashboardAdminRoleId?: string
    membershipSettings?: Settings
    gameOverrides?: Partial<Record<GameId, { membershipSettings?: Settings }>>
}
export type RoleAssignment = {
    type: "member" | "reserve_member" | "mercenary"
    status: "pending" | "recruit" | "active"
    membershipCategoryId?: string
}
const unique = (values: string[]) => [...new Set(values)].sort()

/** The shared clan role has one guild owner; each category role has one game owner. */
export function managedRolePolicy(
    config: ManagedRoleConfig,
    gameId: GameId,
    groupRoleIds: string[]
) {
    const settingsFor = (game: GameId) =>
        config.gameOverrides?.[game]?.membershipSettings ??
        (game === "hell_let_loose" ? config.membershipSettings : undefined)
    const owners = new Map<string, string>()
    const own = (id: string | undefined, owner: string) => {
        if (!id) return
        if (owners.has(id) && owners.get(id) !== owner)
            throw new Error("Conflicting managed role owner.")
        owners.set(id, owner)
    }
    own(config.dashboardAdminRoleId, "dashboard")
    for (const role of groupRoleIds) own(role, "group")
    own(config.clanRoleId, "clan")
    for (const game of GAME_IDS)
        for (const category of settingsFor(game)?.categories ?? [])
            for (const role of [
                ...category.recruitRoleIds,
                ...category.finalRoleIds,
            ])
                own(role, game)
    const settings = settingsFor(gameId)
    const roleIds = settings?.enabled
        ? unique([
              ...(config.clanRoleId ? [config.clanRoleId] : []),
              ...settings.categories.flatMap((category) => [
                  ...category.recruitRoleIds,
                  ...category.finalRoleIds,
              ]),
          ])
        : []
    if (roleIds.length > 100)
        throw new Error("Managed role scope exceeds 100 roles.")
    return {
        roleIds,
        clanRoleId: config.clanRoleId,
        settings,
        dashboardRoleId: config.dashboardAdminRoleId,
    }
}
export type ManagedRolePolicy = ReturnType<typeof managedRolePolicy>

export function desiredMembershipRoles(
    policy: ManagedRolePolicy,
    assignment: RoleAssignment | null
) {
    if (
        !assignment ||
        assignment.status === "pending" ||
        !policy.settings?.enabled
    )
        return []
    const category = policy.settings.categories.find(
        (row) => row.id === assignment.membershipCategoryId
    )
    return unique([
        ...(policy.clanRoleId ? [policy.clanRoleId] : []),
        ...(assignment.status === "recruit"
            ? (category?.recruitRoleIds ?? [])
            : (category?.finalRoleIds ?? [])),
    ])
}
export function planManagedRoleChanges(input: {
    observedRoleIds: string[]
    desiredManagedRoleIds: string[]
    allowedManagedRoleIds: string[]
}) {
    const allowed = new Set(input.allowedManagedRoleIds),
        desired = new Set(input.desiredManagedRoleIds),
        observed = new Set(input.observedRoleIds)
    if ([...desired].some((role) => !allowed.has(role)))
        throw new Error("Desired role outside managed scope.")
    return {
        add: unique([...desired].filter((role) => !observed.has(role))),
        remove: unique(
            [...observed].filter(
                (role) => allowed.has(role) && !desired.has(role)
            )
        ),
    }
}
export function canExecuteManagedRoles(input: {
    kind: RoleActorKind
    actorId: string
    targetId: string
    actorPresent: boolean
    actorAdministrator: boolean
    actorRoleIds: string[]
    adminOverride?: boolean
    dashboardRoleId?: string
    supportRoleIds: string[]
    selfAllowed: boolean
}) {
    if (!input.actorPresent) return false
    if (input.kind === "application" || input.kind === "rollback")
        return input.actorId === input.targetId && input.selfAllowed
    const admin =
        input.actorAdministrator ||
        // Overrides mix manual desired-role settings with cached observations.
        // A true value cannot grant authority; Discord must confirm the role.
        (input.adminOverride !== false &&
            Boolean(
                input.dashboardRoleId &&
                input.actorRoleIds.includes(input.dashboardRoleId)
            ))
    return (
        admin ||
        (input.kind === "recruitment" &&
            input.supportRoleIds.some((role) =>
                input.actorRoleIds.includes(role)
            ))
    )
}

/** Includes identity and write time so a later legacy write cannot inherit an older actor. */
export function roleAssignmentFingerprint(
    value:
        | (RoleAssignment & {
              userId: string
              serverId: string
              gameId?: GameId
              updatedAt?: string
          })
        | null
) {
    return JSON.stringify(
        value
            ? [
                  value.serverId,
                  value.gameId ?? "hell_let_loose",
                  value.userId,
                  value.type,
                  value.status,
                  value.membershipCategoryId ?? null,
                  value.updatedAt ?? null,
              ]
            : null
    )
}
