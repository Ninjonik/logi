export function getRosterImageAttendanceStyle(
    player: { ack: boolean; confirmed?: boolean },
    noticeKind?: "late" | "cannot_come"
) {
    const indicator: "late" | "absent" | null =
        noticeKind === "cannot_come"
            ? "absent"
            : noticeKind === "late"
              ? "late"
              : null
    if (noticeKind === "cannot_come") {
        return { background: "#991b1b", showCheck: false, indicator }
    }
    if (player.confirmed) {
        return { background: "#166534", showCheck: true, indicator }
    }

    if (player.ack) {
        return { background: "#166534", showCheck: false, indicator }
    }

    return { background: "#18324a", showCheck: false, indicator }
}
