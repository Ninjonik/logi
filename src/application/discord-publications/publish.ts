export type Publication = {
    id: string
    fence: number
    channelId: string | null
    messageId: string | null
    pending: { channelId: string; marker: string } | null
    hash: string | null
}
export class PublicationNotSent extends Error {}
/**
 * The durable side of one managed message. `claim` takes the lease and
 * returns the stored state, null while another worker holds it, or the
 * state with `current` when the message Discord shows is already this one
 * (`publicationIsCurrent`), in which case nothing was written and nothing
 * needs releasing. `save` stores an intermediate state under the lease (the
 * pending marker before a create, a recovered or removed message).
 * `finish` releases the lease; on success it stores `value` in the same
 * write, under the same fence and lease check as `save`.
 */
export type PublicationStore = {
    claim(): Promise<(Publication & { current?: boolean }) | null>
    save(value: Publication): Promise<void>
    finish(value: Publication, error?: unknown): Promise<void>
}
/** exists/remove must distinguish Discord's Unknown Message from all other errors,
 * and every transport operation must enforce bot ownership and the target guild. */
export type PublicationTransport = {
    exists(channelId: string, messageId: string): Promise<boolean>
    recover(channelId: string, marker: string): Promise<string | null>
    create(channelId: string, marker: string): Promise<string>
    edit(channelId: string, messageId: string): Promise<void>
    remove(channelId: string, messageId: string): Promise<void>
}

export async function publish(
    store: PublicationStore,
    transport: PublicationTransport,
    target: string | null,
    hash: string
) {
    const claimed = await store.claim()
    if (!claimed) return undefined
    const { current, ...state } = claimed
    // Discord already shows this render and confirmed it recently.
    if (current) return state.messageId
    try {
        if (state.pending) {
            const recovered = await transport.recover(
                state.pending.channelId,
                state.pending.marker
            )
            if (!recovered)
                throw new Error(
                    "Delivery uncertain: exact message marker not found in recent history. Operator reconciliation required."
                )
            state.channelId = state.pending.channelId
            state.messageId = recovered
            state.pending = null
            state.hash = null
            await store.save(state)
        }
        if (state.channelId && state.messageId) {
            if (!(await transport.exists(state.channelId, state.messageId))) {
                state.messageId = null
                state.hash = null
                await store.save(state)
            } else if (state.channelId !== target) {
                await transport.remove(state.channelId, state.messageId)
                state.messageId = null
                state.hash = null
                await store.save(state)
            }
        }
        if (target && state.messageId) {
            if (state.hash !== hash)
                await transport.edit(target, state.messageId)
        } else if (target) {
            state.pending = {
                channelId: target,
                marker: `logi:publication:${state.id}:${state.fence}`,
            }
            // This write must succeed before Discord receives the POST. A lost
            // response or expired lease never becomes permission to POST again.
            await store.save(state)
            state.messageId = await transport.create(
                target,
                state.pending.marker
            )
            state.pending = null
        }
        state.channelId = target
        state.hash = target ? hash : null
        await store.finish(state)
        return state.messageId
    } catch (error) {
        if (error instanceof PublicationNotSent && state.pending) {
            state.pending = null
            await store.save(state)
        }
        await store.finish(state, error)
        throw error
    }
}
