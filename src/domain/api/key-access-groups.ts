import { API_KEY_READ_RESOURCES, type ApiKeyReadAccess } from "./key-access"

type Resource = ApiKeyReadAccess["resources"][number]

/**
 * Read resources an administrator picks as a few areas instead of one box
 * per resource (design G5). Every resource belongs to exactly one area.
 */
export const API_KEY_RESOURCE_GROUPS = {
    matches: [
        "events",
        "matches",
        "event-summaries",
        "match-summaries",
        "stratmaps",
    ],
    rosters: ["rosters", "roster-summaries", "groups", "assignments"],
    results: [
        "result-summaries",
        "player-stat-summaries",
        "server-game-history",
    ],
    members: ["member-summaries", "membership-summaries"],
    servers: [
        "server-snapshots",
        "warcon-data",
        "hll-live",
        "integration-health",
    ],
    league: ["league-matches", "league-fixtures", "teams"],
} as const satisfies Record<string, readonly Resource[]>

export type ApiKeyResourceGroup = keyof typeof API_KEY_RESOURCE_GROUPS
export const API_KEY_RESOURCE_GROUP_IDS = Object.keys(
    API_KEY_RESOURCE_GROUPS
) as ApiKeyResourceGroup[]

/** The resources a key gets for the chosen areas, in a stable order. */
export function resourcesForGroups(
    groups: readonly ApiKeyResourceGroup[]
): Resource[] {
    const chosen = new Set<Resource>(
        groups.flatMap((group) => API_KEY_RESOURCE_GROUPS[group])
    )
    return API_KEY_READ_RESOURCES.filter((resource) => chosen.has(resource))
}

/**
 * Which areas a key covers: `full` when it reads every resource of an area,
 * `partial` when only some (keys created before areas existed).
 */
export function groupsOfResources(resources: readonly string[]) {
    const held = new Set(resources)
    const full: ApiKeyResourceGroup[] = []
    const partial: ApiKeyResourceGroup[] = []
    for (const group of API_KEY_RESOURCE_GROUP_IDS) {
        const members: readonly string[] = API_KEY_RESOURCE_GROUPS[group]
        const count = members.filter((resource) => held.has(resource)).length
        if (count === members.length) full.push(group)
        else if (count > 0) partial.push(group)
    }
    return { full, partial }
}
