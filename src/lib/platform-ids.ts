export type PlatformKey = "steam" | "epic" | "xbox" | "playstation" | "other"

const PLATFORM_PREFIX_MAP: Record<string, PlatformKey> = {
    steam: "steam",
    epic: "epic",
    xbox: "xbox",
    xbl: "xbox",
    playstation: "playstation",
    psn: "playstation",
    ps: "playstation",
    other: "other",
}

const STEAM_ID64_REGEX = /^7656119\d{10}$/
const STEAM_LEGACY_REGEX = /^steam_[0-5]:[01]:\d+$/i
const EPIC_UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EPIC_HEX32_REGEX = /^[0-9a-f]{32}$/i

function splitPlatformPrefix(value: string) {
    const match = value.trim().match(/^([a-z]+):(.*)$/i)
    if (!match) {
        return null
    }

    const key = PLATFORM_PREFIX_MAP[match[1].toLowerCase()]
    if (!key) {
        return null
    }

    return {
        platform: key,
        rawId: match[2].trim(),
    }
}

export function stripPlatformPrefix(value: string) {
    return splitPlatformPrefix(value)?.rawId ?? value.trim()
}

export function detectPlatformFromId(value: string): PlatformKey {
    const trimmed = value.trim()
    if (!trimmed) {
        return "other"
    }

    const prefixed = splitPlatformPrefix(trimmed)
    if (prefixed) {
        return prefixed.platform
    }

    const normalized = trimmed.toLowerCase()
    if (STEAM_ID64_REGEX.test(trimmed) || STEAM_LEGACY_REGEX.test(trimmed)) {
        return "steam"
    }

    if (EPIC_UUID_REGEX.test(trimmed) || EPIC_HEX32_REGEX.test(normalized)) {
        return "epic"
    }

    return "other"
}

export function parsePlatformIdsInput(
    value: string | string[] | undefined | null
) {
    const values = Array.isArray(value) ? value : [value ?? ""]

    return [
        ...new Set(
            values
                .flatMap((entry) => entry.split(","))
                .map((entry) =>
                    stripPlatformPrefix(entry).replace(/\s+/g, "").trim()
                )
                .filter(Boolean)
        ),
    ]
}

export function formatPlatformIds(value: string[] | undefined | null) {
    return value?.length
        ? value.map((entry) => stripPlatformPrefix(entry)).join(", ")
        : ""
}

export function getPlatformLabel(
    platform: PlatformKey,
    labels: Record<PlatformKey, string>
) {
    return labels[platform]
}

export function getPlatformProfileUrl(platformId: string) {
    const rawId = stripPlatformPrefix(platformId)
    const platform = detectPlatformFromId(platformId)

    if (platform === "steam" && STEAM_ID64_REGEX.test(rawId)) {
        return `https://steamcommunity.com/profiles/${rawId}`
    }

    return undefined
}

export function describePlatformId(
    platformId: string,
    labels: Record<PlatformKey, string>
) {
    const rawId = stripPlatformPrefix(platformId)
    const platform = detectPlatformFromId(platformId)
    return {
        value: platformId,
        rawId,
        platform,
        label: getPlatformLabel(platform, labels),
        profileUrl: getPlatformProfileUrl(platformId),
    }
}

export function describePlatformIds(
    platformIds: string[] | undefined | null,
    labels: Record<PlatformKey, string>
) {
    return (platformIds ?? []).map((platformId) =>
        describePlatformId(platformId, labels)
    )
}

/** Longest platform ID the dashboard accepts. */
export const MAX_PLATFORM_ID_LENGTH = 64

/**
 * Why an entered platform ID cannot be saved as typed. `duplicate` only
 * informs: the ID is saved once.
 */
export type PlatformIdIssue =
    | "steam_format"
    | "epic_format"
    | "too_long"
    | "duplicate"
    | "linked_elsewhere"

export type PlatformIdAssessment = {
    rawId: string
    platform: PlatformKey
    issue?: PlatformIdIssue
}

/**
 * Checks the comma-separated platform IDs typed for one player before they
 * are saved. `takenIds` maps IDs already linked to other players to a name to
 * show. A Steam ID must be the 17-digit SteamID64, so a long number that is
 * not one is reported as a mistyped Steam ID.
 */
export function assessPlatformIdsInput(
    input: string,
    takenIds: ReadonlyMap<string, string> = new Map()
): { entries: PlatformIdAssessment[]; hasErrors: boolean } {
    const seen = new Set<string>()
    const entries = input
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry): PlatformIdAssessment => {
            const prefixed = splitPlatformPrefix(entry)
            const rawId = stripPlatformPrefix(entry).replace(/\s+/g, "")
            const platform = detectPlatformFromId(entry)
            const key = rawId.toLowerCase()
            let issue: PlatformIdIssue | undefined
            if (rawId.length > MAX_PLATFORM_ID_LENGTH) issue = "too_long"
            else if (
                (prefixed?.platform === "steam" ||
                    (!prefixed && /^\d{15,}$/.test(rawId))) &&
                !STEAM_ID64_REGEX.test(rawId) &&
                !STEAM_LEGACY_REGEX.test(rawId)
            )
                issue = "steam_format"
            else if (
                prefixed?.platform === "epic" &&
                !EPIC_UUID_REGEX.test(rawId) &&
                !EPIC_HEX32_REGEX.test(rawId)
            )
                issue = "epic_format"
            else if (seen.has(key)) issue = "duplicate"
            else if (takenIds.has(rawId)) issue = "linked_elsewhere"
            seen.add(key)
            return { rawId, platform, ...(issue ? { issue } : {}) }
        })
    return {
        entries,
        hasErrors: entries.some(
            (entry) => entry.issue && entry.issue !== "duplicate"
        ),
    }
}
