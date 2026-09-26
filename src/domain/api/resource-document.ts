export type ClanApiResourceDocument =
    | "events"
    | "groups"
    | "rosters"
    | "assignments"
    | "calendar-items"
    | "stratmaps"
    | "topic-presets"
    | "squad-presets"
    | "matches"
    | "articles"
    | "users"

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

/**
 * A Convex ID is opaque and `db.get` is not table-qualified at runtime. Check
 * the resource's required persisted fields before returning a generic lookup.
 */
export function isClanApiResourceDocument(
    resource: ClanApiResourceDocument,
    value: unknown
) {
    if (!isRecord(value)) return false
    switch (resource) {
        case "events":
            return (
                typeof value.name === "string" &&
                typeof value.registrationEnd === "string" &&
                typeof value.meetingStart === "string" &&
                typeof value.gameEnd === "string"
            )
        case "groups":
            return (
                typeof value.name === "string" &&
                typeof value.color === "string" &&
                typeof value.order === "number"
            )
        case "rosters":
            return (
                "eventId" in value &&
                Array.isArray(value.squads) &&
                Array.isArray(value.reservePlayerIds)
            )
        case "assignments":
            return (
                typeof value.serverId === "string" &&
                typeof value.userId === "string"
            )
        case "calendar-items":
            return (
                typeof value.title === "string" &&
                typeof value.startAt === "string" &&
                typeof value.endAt === "string"
            )
        case "stratmaps":
            return (
                typeof value.title === "string" &&
                typeof value.baseMapId === "string" &&
                typeof value.state === "string"
            )
        case "topic-presets":
            return typeof value.name === "string" && Array.isArray(value.topics)
        case "squad-presets":
            return typeof value.name === "string" && Array.isArray(value.squads)
        case "matches":
            return (
                typeof value.matchId === "string" &&
                "eventId" in value &&
                "raw" in value
            )
        case "articles":
            return (
                typeof value.title === "string" &&
                typeof value.body === "string" &&
                typeof value.authorId === "string"
            )
        case "users":
            return Array.isArray(value.managedGuildIds)
    }
}
