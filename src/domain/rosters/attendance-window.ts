/**
 * When a rostered player can answer the attendance question from a button
 * (board L2-B07, L1-B08): confirming opens with the attendance window (a day
 * before the meeting, the event's `starting` status); running late and
 * cannot-come work until the game starts; after the start every answer is
 * refused with "Zápas už začal".
 */

export type AttendanceAnswerWindow = "not_open" | "open" | "started"

export function attendanceAnswerWindow(
    event: {
        status: "registration" | "closed" | "starting" | "concluded"
        gameStart: string
    },
    now: number
): AttendanceAnswerWindow {
    const start = Date.parse(event.gameStart)
    if (
        event.status === "concluded" ||
        (Number.isFinite(start) && now >= start)
    )
        return "started"
    return event.status === "starting" ? "open" : "not_open"
}

/** Whether the player is in a squad slot or a reserve of the roster. */
export function isOnRoster(
    roster:
        | {
              squads: ReadonlyArray<{
                  players: ReadonlyArray<{ id?: string | null }>
              }>
              reservePlayerIds: readonly string[]
          }
        | null
        | undefined,
    userId: string
) {
    return Boolean(
        roster &&
        (roster.squads.some((squad) =>
            squad.players.some((player) => player.id === userId)
        ) ||
            roster.reservePlayerIds.includes(userId))
    )
}
