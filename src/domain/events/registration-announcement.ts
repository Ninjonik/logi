/**
 * A missing start time is deliberately treated as immediately due so events
 * created before delayed announcements existed retain their original behavior.
 */
export function isRegistrationAnnouncementDue(
    event: { registrationStart?: string },
    now: Date = new Date()
) {
    if (!event.registrationStart) return true

    const registrationStart = new Date(event.registrationStart).getTime()
    return (
        !Number.isFinite(registrationStart) ||
        registrationStart <= now.getTime()
    )
}
