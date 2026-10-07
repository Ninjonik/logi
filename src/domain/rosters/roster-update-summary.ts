/**
 * What changed between two versions of a published roster, per player: who
 * is new on it, who left it (and whether into the reserves), who moved to
 * another squad and whose role changed. The bot builds the change digest and
 * the change DMs from it; the publish dialog shows the same list before
 * publishing. A player without a role has none: no "Unassigned" text.
 */

/** A player's place on the roster: the squad and the role, if any. */
export type RosterPlace = { squad: string; role?: string }

/** A roster's squad slots, by player Discord ID. */
export type RosterPlaces = Readonly<Record<string, RosterPlace>>

/** One slot of a stored snapshot (Convex keeps an array). */
export type RosterPlaceSnapshot = {
    userId: string
    squad: string
    role?: string
}

export type RosterPlayerChange = {
    userId: string
    before?: RosterPlace
    after?: RosterPlace
    /** New in a squad slot. */
    added: boolean
    /** No longer in a squad slot. */
    removed: boolean
    /** Removed from the squads into the reserves. */
    toReserves: boolean
    /** In another squad. */
    moved: boolean
    /** Another role (or a role added or taken away). */
    roleChanged: boolean
}

type SquadsLike = {
    squads: ReadonlyArray<{
        name: string
        players: ReadonlyArray<{ id?: string | null; roleName?: string | null }>
    }>
}

const clean = (value: string | null | undefined) =>
    value?.replace(/[\s\p{Cc}]+/gu, " ").trim() || undefined

/** The squad places of a roster's players; the first slot wins for duplicates. */
export function rosterPlaces(roster: SquadsLike): RosterPlaces {
    const places: Record<string, RosterPlace> = {}
    for (const squad of roster.squads) {
        for (const player of squad.players) {
            const id = player.id?.trim()
            if (!id || places[id]) continue
            const role = clean(player.roleName)
            places[id] = {
                squad: clean(squad.name) ?? "",
                ...(role ? { role } : {}),
            }
        }
    }
    return places
}

/** The places as the array Convex stores. */
export function placesToSnapshot(places: RosterPlaces): RosterPlaceSnapshot[] {
    return Object.entries(places).map(([userId, place]) => ({
        userId,
        squad: place.squad,
        ...(place.role ? { role: place.role } : {}),
    }))
}

/**
 * The published versions a publish stores on the roster (D5-B04): the
 * squad places it publishes, and the places of the version it replaces, the
 * baseline of the change digest and the change DMs. The server keeps both,
 * so no browser decides what "the last published version" was. A first
 * publish has no baseline; a roster published before the snapshots existed
 * counts its saved squads as the version it replaces.
 */
export function publishedSnapshots(input: {
    previous:
        | (SquadsLike & {
              published: boolean
              publishedPlaces?: readonly RosterPlaceSnapshot[]
          })
        | null
        | undefined
    next: SquadsLike
}): {
    publishedPlaces: RosterPlaceSnapshot[]
    previousPublishedPlaces: RosterPlaceSnapshot[] | undefined
} {
    const { previous } = input
    const baseline = previous?.publishedPlaces
        ? [...previous.publishedPlaces]
        : previous?.published
          ? placesToSnapshot(rosterPlaces(previous))
          : undefined
    return {
        publishedPlaces: placesToSnapshot(rosterPlaces(input.next)),
        previousPublishedPlaces: baseline,
    }
}

/** A stored snapshot back as places. */
export function snapshotToPlaces(
    snapshot: readonly RosterPlaceSnapshot[]
): RosterPlaces {
    const places: Record<string, RosterPlace> = {}
    for (const slot of snapshot) {
        if (!slot.userId || places[slot.userId]) continue
        places[slot.userId] = {
            squad: slot.squad,
            ...(slot.role ? { role: slot.role } : {}),
        }
    }
    return places
}

/**
 * Every player whose place changed between `before` and `after`, in a
 * stable order: added, then moved or re-roled, then removed, each by the
 * order the player appears in.
 */
export function diffRosterPlaces(
    before: RosterPlaces,
    after: RosterPlaces,
    reservesAfter: readonly string[] = []
): RosterPlayerChange[] {
    const reserves = new Set(reservesAfter)
    const changes: RosterPlayerChange[] = []
    for (const [userId, next] of Object.entries(after)) {
        const previous = before[userId]
        if (!previous) {
            changes.push({
                userId,
                after: next,
                added: true,
                removed: false,
                toReserves: false,
                moved: false,
                roleChanged: false,
            })
            continue
        }
        const moved = previous.squad !== next.squad
        const roleChanged = (previous.role ?? "") !== (next.role ?? "")
        if (moved || roleChanged)
            changes.push({
                userId,
                before: previous,
                after: next,
                added: false,
                removed: false,
                toReserves: false,
                moved,
                roleChanged,
            })
    }
    for (const [userId, previous] of Object.entries(before)) {
        if (after[userId]) continue
        changes.push({
            userId,
            before: previous,
            added: false,
            removed: true,
            toReserves: reserves.has(userId),
            moved: false,
            roleChanged: false,
        })
    }
    const rank = (change: RosterPlayerChange) =>
        change.added ? 0 : change.removed ? 2 : 1
    return changes
        .map((change, index) => ({ change, index }))
        .sort(
            (left, right) =>
                rank(left.change) - rank(right.change) ||
                left.index - right.index
        )
        .map(({ change }) => change)
}

/** The publish dialog's chips: "+2", "−1", "3 přesunuto". */
export function countRosterPlayerChanges(
    changes: readonly RosterPlayerChange[]
) {
    return {
        added: changes.filter((change) => change.added).length,
        removed: changes.filter((change) => change.removed).length,
        moved: changes.filter((change) => change.moved || change.roleChanged)
            .length,
    }
}

/** Players a change DM may go to: changed and a member of the clan. */
export function changedRecipients(
    changes: readonly RosterPlayerChange[],
    memberIds: ReadonlySet<string>
) {
    return [
        ...new Set(
            changes
                .map((change) => change.userId)
                .filter((userId) => memberIds.has(userId))
        ),
    ]
}
