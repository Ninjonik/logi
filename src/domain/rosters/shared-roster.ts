import { canEditSharedSlot } from "./shared-slot-policy"
import type { RosterLike, RosterPlayer } from "./types"

export type SharedRosterSlot = RosterPlayer & {
    allocatedGuildId?: string
    locked?: boolean
}

/** A second write in the same millisecond still gets a distinct optimistic revision. */
export function rosterRevisionTimestamp(
    previous: string | undefined,
    now: Date
) {
    const last = Date.parse(previous ?? "")
    return new Date(
        Math.max(now.getTime(), Number.isFinite(last) ? last + 1 : 0)
    ).toISOString()
}

function sameFields(left: object, right: object) {
    return Object.keys({ ...left, ...right }).every(
        (key) => Reflect.get(left, key) === Reflect.get(right, key)
    )
}

/** Guest whole-board saves may change assignments only, never allocation or layout. */
export function assertGuestRosterEdit(input: {
    hostGuildId: string
    actorGuildId: string
    before: RosterLike
    after: RosterLike
    eligibleUserIds: ReadonlySet<string>
}) {
    const { before, after } = input
    if (
        before.published !== after.published ||
        before.streamerId !== after.streamerId ||
        before.squadPresetId !== after.squadPresetId ||
        before.squads.length !== after.squads.length
    )
        throw new Error(
            "Only the host can change the roster structure or publication."
        )
    before.squads.forEach((squad, squadIndex) => {
        const next = after.squads[squadIndex]
        const { players, ...layout } = squad
        const { players: nextPlayers, ...nextLayout } = next
        if (
            !sameFields(layout, nextLayout) ||
            players.length !== nextPlayers.length
        )
            throw new Error("Only the host can change the roster structure.")
        players.forEach((previous, index) => {
            const player = nextPlayers[index]
            if (sameFields(previous, player)) return
            if (
                !canEditSharedSlot({
                    ...input,
                    invitationActive: true,
                    slot: previous,
                })
            )
                throw new Error("This slot is read-only for your clan.")
            const metadata = (slot: SharedRosterSlot) => [
                slot.allocatedGuildId,
                slot.locked,
                slot.roleName,
                slot.roleIcon,
                slot.note,
            ]
            if (
                JSON.stringify(metadata(previous)) !==
                JSON.stringify(metadata(player))
            )
                throw new Error(
                    "Only the host can change slot allocation, locks or role details."
                )
            if (
                player.customName ||
                (player.id && !input.eligibleUserIds.has(player.id))
            )
                throw new Error("Choose a player belonging to your clan.")
        })
    })
    for (const list of ["reservePlayerIds", "notAttendingPlayerIds"] as const)
        if (after[list].some((id) => !input.eligibleUserIds.has(id)))
            throw new Error("You can manage only your clan's players.")
    if (
        after.reserveAttendances?.some(
            (item) =>
                !input.eligibleUserIds.has(item.userId) ||
                !after.reservePlayerIds.includes(item.userId)
        )
    )
        throw new Error("You can manage only your clan's players.")
}

export function assertUniqueRosterPlayers(roster: RosterLike) {
    const ids = roster.squads.flatMap((squad) =>
        squad.players.flatMap((slot) => (slot.id ? [slot.id] : []))
    )
    if (new Set(ids).size !== ids.length)
        throw new Error("A player can occupy only one slot in a shared match.")
}
