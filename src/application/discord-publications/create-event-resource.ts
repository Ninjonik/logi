/** Creates one event-owned Discord resource. An ambiguous POST is never replayed. */
export type ResourceClaim = {
    id: string
    fence: number
    resourceId: string | null
}
export type EventResourceStore = {
    claim(): Promise<ResourceClaim>
    begin(claim: ResourceClaim): Promise<void>
    finish(claim: ResourceClaim, resourceId: string): Promise<void>
    fail(claim: ResourceClaim, rejected: boolean): Promise<void>
}
export class ResourceCreateRejected extends Error {
    constructor(public readonly deliveryCause: unknown) {
        super("Discord rejected resource creation")
    }
}

export async function createEventResource<T extends { id: string }>(
    store: EventResourceStore,
    transport: {
        find(id: string): Promise<T | null>
        create(): Promise<T>
        rejected(error: unknown): boolean
    }
): Promise<T> {
    const claim = await store.claim()
    let started = false
    let accepted = false
    try {
        if (claim.resourceId) {
            const existing = await transport.find(claim.resourceId)
            if (existing) {
                await store.finish(claim, existing.id)
                return existing
            }
        }
        await store.begin(claim)
        started = true
        const resource = await transport.create()
        accepted = true
        await store.finish(claim, resource.id)
        return resource
    } catch (error) {
        // Receipt-write failures after acceptance must never reset the boundary.
        const rejected = started && !accepted && transport.rejected(error)
        await store.fail(claim, rejected)
        if (rejected) throw new ResourceCreateRejected(error)
        throw error
    }
}
