const supportedTimezones = new Set([
    "UTC",
    "Europe/Bratislava",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Prague",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Australia/Sydney",
])

const discordFields = [
    "announcementsChannelId",
    "eventInfoChannelId",
    "errorsChannelId",
    "calendarChannelId",
    "forumCategoryId",
    "meetingChannelId",
    "clanRoleId",
    "dashboardAdminRoleId",
] as const

type DiscordField = (typeof discordFields)[number]

export type ClanSettingsPatch = {
    name?: string
    avatar?: string
    description?: string | null
    timezone?: string
    defaultLanguage?: "en" | "cs" | "de"
} & Partial<Record<DiscordField, string | null>>

export function parseClanSettingsPatch(
    value: unknown
): { ok: true; value: ClanSettingsPatch } | { ok: false; error: string } {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return { ok: false, error: "Settings patch must be an object." }
    const input = value as Record<string, unknown>
    const allowed = new Set([
        "name",
        "avatar",
        "description",
        "timezone",
        "defaultLanguage",
        ...discordFields,
    ])
    if (
        !Object.keys(input).length ||
        Object.keys(input).some((key) => !allowed.has(key))
    )
        return {
            ok: false,
            error: "Settings patch contains an unsupported field.",
        }

    const patch: ClanSettingsPatch = {}
    for (const [field, raw] of Object.entries(input)) {
        if (
            field === "description" ||
            discordFields.includes(field as DiscordField)
        ) {
            if (raw === null) {
                patch[field as "description" | DiscordField] = null
                continue
            }
        }
        if (typeof raw !== "string")
            return {
                ok: false,
                error: "Settings patch contains an unsupported value.",
            }
        const trimmed = raw.trim()
        if (!trimmed)
            return {
                ok: false,
                error: "Settings patch values cannot be empty.",
            }
        if (field === "timezone" && !supportedTimezones.has(trimmed))
            return { ok: false, error: "timezone is not supported." }
        if (
            field === "defaultLanguage" &&
            !["en", "cs", "de"].includes(trimmed)
        )
            return { ok: false, error: "defaultLanguage is not supported." }
        if (
            discordFields.includes(field as DiscordField) &&
            !/^\d+$/.test(trimmed)
        )
            return { ok: false, error: "Discord IDs must contain only digits." }
        if (field === "defaultLanguage")
            patch.defaultLanguage = trimmed as "en" | "cs" | "de"
        else if (field === "timezone") patch.timezone = trimmed
        else if (field === "name") patch.name = trimmed
        else if (field === "avatar") patch.avatar = trimmed
        else if (field === "description") patch.description = trimmed
        else patch[field as DiscordField] = trimmed
    }
    return { ok: true, value: patch }
}
