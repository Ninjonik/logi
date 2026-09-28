/**
 * Match recap messages are opt-out: older user records without a stored
 * preference continue to receive them, while an explicit false blocks them.
 */
export function canReceiveMatchRecap(
    matchRecapNotificationsEnabled: boolean | undefined
) {
    return matchRecapNotificationsEnabled !== false
}
