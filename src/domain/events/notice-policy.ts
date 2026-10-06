import type { EventNotice, EventParticipant, EventStatus } from "./types"

export function findEligibleNoticeTargets(input: {
    events: Array<{
        id: string
        name: string
        gameStart: string
        status: EventStatus
        participants: EventParticipant[]
        reservePlayerIds?: string[]
    }>
    userId: string
    query: string
    now: Date
}) {
    const normalizedQuery = input.query.trim().toLowerCase()
    const nowValue = input.now.getTime()

    return input.events
        .filter((event) => {
            const gameStart = new Date(event.gameStart).getTime()
            const isEligibleTime =
                Number.isFinite(gameStart) && nowValue < gameStart
            const participant = event.participants.find(
                (entry) => entry.userId === input.userId
            )
            const isReserve =
                event.reservePlayerIds?.includes(input.userId) ?? false

            if (
                !isEligibleTime ||
                event.status === "concluded" ||
                (participant?.status !== "attending" && !isReserve)
            ) {
                return false
            }

            if (!normalizedQuery) {
                return true
            }

            return (
                event.name.toLowerCase().includes(normalizedQuery) ||
                event.id.toLowerCase().includes(normalizedQuery)
            )
        })
        .slice(0, 25)
}

/**
 * The person's event that already started and matches what they typed in
 * `/notice` (M3-19): signed up (attending or reserve), started or concluded,
 * its ID or name matching like {@link findEligibleNoticeTargets}. `/notice`
 * then answers "VLK vs ROG už začal" instead of "not signed up". The most
 * recently started one wins; null when none matches or nothing was typed.
 */
export function findStartedNoticeEvent(input: {
    events: Array<{
        id: string
        name: string
        gameStart: string
        status: EventStatus
        participants: EventParticipant[]
        reservePlayerIds?: string[]
    }>
    userId: string
    query: string
    now: Date
}): { id: string; name: string; gameStart: string } | null {
    const query = input.query.trim().toLowerCase()
    if (!query) return null
    const nowValue = input.now.getTime()
    const started = input.events
        .filter((event) => {
            const gameStart = new Date(event.gameStart).getTime()
            const hasStarted =
                event.status === "concluded" ||
                (Number.isFinite(gameStart) && gameStart <= nowValue)
            const signedUp =
                event.participants.some(
                    (entry) =>
                        entry.userId === input.userId &&
                        entry.status === "attending"
                ) ||
                (event.reservePlayerIds?.includes(input.userId) ?? false)
            return (
                hasStarted &&
                signedUp &&
                (event.id.toLowerCase() === query ||
                    event.name.toLowerCase().includes(query))
            )
        })
        .sort(
            (a, b) =>
                (Date.parse(b.gameStart) || 0) - (Date.parse(a.gameStart) || 0)
        )
    const found = started[0]
    return found
        ? { id: found.id, name: found.name, gameStart: found.gameStart }
        : null
}

export function upsertNotice(input: {
    event: {
        gameStart: string
        status: EventStatus
        participants: EventParticipant[]
        reservePlayerIds?: string[]
        absenceNotices: EventNotice[]
    }
    userId: string
    reason: string
    now: Date
}) {
    const nowValue = input.now.getTime()
    const gameStart = new Date(input.event.gameStart).getTime()

    if (!Number.isFinite(gameStart) || nowValue >= gameStart) {
        throw new Error("Notice can only be submitted before game start.")
    }

    if (input.event.status === "concluded") {
        throw new Error("This event is already concluded.")
    }

    const participant = input.event.participants.find(
        (entry) => entry.userId === input.userId
    )
    const isReserve =
        input.event.reservePlayerIds?.includes(input.userId) ?? false
    if (participant?.status !== "attending" && !isReserve) {
        throw new Error("Only attending players can submit a notice.")
    }

    const notices = input.event.absenceNotices.filter(
        (entry) => entry.userId !== input.userId
    )
    notices.push({
        userId: input.userId,
        reason: input.reason.trim(),
        createdAt: input.now.toISOString(),
        kind: "late",
    })

    return notices
}
