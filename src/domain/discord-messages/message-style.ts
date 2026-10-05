/**
 * The clan's look for every bot message (design D4): one accent colour and
 * how many icons the lines of a message carry. Event categories keep their
 * own colour; factions and teams always keep their sign.
 */

export const MESSAGE_ICON_DENSITIES = ["sparse", "rich"] as const
export type MessageIconDensity = (typeof MESSAGE_ICON_DENSITIES)[number]

export type MessageStyle = {
    /** `#RRGGBB`; missing means Logi amber. */
    accentColor?: string
    /** Missing means `sparse`, the look before the setting existed. */
    iconDensity?: MessageIconDensity
}

const HEX_COLOR = /^#?([0-9a-f]{6})$/i

/** `#RRGGBB` in upper case, or undefined for anything but a six-digit hex colour. */
export function normalizeAccentColor(
    value: string | null | undefined
): string | undefined {
    const match = value?.trim().match(HEX_COLOR)
    return match ? `#${match[1]!.toUpperCase()}` : undefined
}

/** A stored style with only valid values; unknown or broken values are dropped. */
export function normalizeMessageStyle(
    style: { accentColor?: unknown; iconDensity?: unknown } | null | undefined
): MessageStyle {
    const accentColor =
        typeof style?.accentColor === "string"
            ? normalizeAccentColor(style.accentColor)
            : undefined
    const iconDensity = MESSAGE_ICON_DENSITIES.find(
        (density) => density === style?.iconDensity
    )
    return {
        ...(accentColor ? { accentColor } : {}),
        ...(iconDensity ? { iconDensity } : {}),
    }
}

/** Lines of a match announcement that can start with an icon. */
export type MessageLine =
    "side" | "teams" | "start" | "details" | "server" | "status" | "forum"

const LINE_ICONS: Record<MessageLine, string> = {
    side: "⚔️",
    teams: "🛡️",
    start: "🕒",
    details: "🗺️",
    server: "🖥️",
    status: "📋",
    forum: "💬",
}

/** Lines that keep their icon in the sparse style: factions and teams. */
const ALWAYS: ReadonlySet<MessageLine> = new Set(["teams"])

/**
 * The icon and a space to put before a message line, or "" when the clan's
 * style leaves it out.
 */
export function messageLineIcon(
    line: MessageLine,
    density: MessageIconDensity | undefined
): string {
    return density === "rich" || ALWAYS.has(line) ? `${LINE_ICONS[line]} ` : ""
}
