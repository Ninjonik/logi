/** Discord thread names retain a stable event suffix even when their display title changes. */
export function debriefThreadName(
    label: string,
    eventName: string,
    eventId: string
) {
    const suffix = ` \u00b7 ${eventId}`
    return (
        `${label} \u00b7 ${eventName}`.slice(
            0,
            Math.max(0, 100 - suffix.length)
        ) + suffix
    )
}

/** Older bot releases accidentally encoded the separator twice. Recover those too. */
export function matchesDebriefThreadName(name: string, eventId: string) {
    return (
        name.endsWith(` \u00b7 ${eventId}`) ||
        name.endsWith(` \u00c2\u00b7 ${eventId}`)
    )
}
