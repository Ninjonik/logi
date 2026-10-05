/**
 * Events link stratmaps by ID. Deleting a stratmap removes it from every event
 * of the same clan that links it, so no event keeps a link to a missing map.
 */

export type StratmapLinkingEvent = {
    id: string
    name: string
    stratmapIds?: readonly string[]
}

/** Events that link the stratmap, in their original order. */
export function findEventsLinkingStratmap<T extends StratmapLinkingEvent>(
    events: readonly T[],
    stratmapId: string
): T[] {
    return events.filter((event) =>
        (event.stratmapIds ?? []).some((id) => id === stratmapId)
    )
}

/** The event's stratmap links without the deleted stratmap. */
export function withoutStratmap<T extends string>(
    stratmapIds: readonly T[] | undefined,
    stratmapId: string
): T[] {
    return (stratmapIds ?? []).filter((id) => id !== stratmapId)
}
