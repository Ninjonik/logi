import type { RosterLike, RosterPlayer, RosterSquad } from "./types"

type ComparableRoster = Pick<
    RosterLike,
    "squads" | "reservePlayerIds" | "notAttendingPlayerIds" | "squadPresetId"
>

function slotKey(player: RosterPlayer | undefined) {
    if (!player) return "missing"
    return JSON.stringify([
        player.id ?? null,
        player.customName?.trim() || null,
        Boolean(player.ack),
        Boolean(player.confirmed),
        player.roleName ?? null,
        player.roleIcon ?? null,
        player.note ?? null,
    ])
}

function squadKey(squad: RosterSquad | undefined) {
    if (!squad) return "missing"
    return JSON.stringify([
        squad.name,
        squad.group,
        squad.color,
        squad.icon ?? null,
    ])
}

function differentMembers(left: readonly string[], right: readonly string[]) {
    const a = new Set(left)
    const b = new Set(right)
    let count = 0
    for (const id of a) if (!b.has(id)) count += 1
    for (const id of b) if (!a.has(id)) count += 1
    return count
}

/**
 * How many edits separate a draft roster from the saved one, for the
 * "unsaved changes" count: each changed slot or squad, and each player who
 * moved in or out of the reserves or the not-attending list.
 */
export function countRosterChanges(
    saved: ComparableRoster | null | undefined,
    draft: ComparableRoster | null | undefined
) {
    if (!saved || !draft) return saved === draft ? 0 : 1
    let count = saved.squadPresetId === draft.squadPresetId ? 0 : 1
    const squadCount = Math.max(saved.squads.length, draft.squads.length)
    for (let index = 0; index < squadCount; index += 1) {
        const before = saved.squads[index]
        const after = draft.squads[index]
        if (squadKey(before) !== squadKey(after)) count += 1
        const slots = Math.max(
            before?.players.length ?? 0,
            after?.players.length ?? 0
        )
        for (let slot = 0; slot < slots; slot += 1) {
            if (
                slotKey(before?.players[slot]) !== slotKey(after?.players[slot])
            )
                count += 1
        }
    }
    count += differentMembers(saved.reservePlayerIds, draft.reservePlayerIds)
    count += differentMembers(
        saved.notAttendingPlayerIds,
        draft.notAttendingPlayerIds
    )
    return count
}
