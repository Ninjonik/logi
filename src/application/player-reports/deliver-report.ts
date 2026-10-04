export type ReportDeliveryClaim = {
    kind: "claimed"
    canCreate: boolean
    fence: number
    threadId: string | null
    marker: string
}
/** A timed-out thread create is reconciled by marker. It is never blindly repeated. */
export async function deliverPlayerReport<
    C extends ReportDeliveryClaim,
>(ports: {
    claim(): Promise<
        C | { kind: "open"; threadId: string } | { kind: "busy" | "blocked" }
    >
    find(claim: C): Promise<string | null>
    create(claim: C): Promise<string>
    bind(claim: C, threadId: string): Promise<void>
    preparePrivateThread(claim: C, threadId: string): Promise<void>
    starter(claim: C, threadId: string): Promise<string>
    complete(claim: C, messageId: string): Promise<void>
    uncertain(claim: C): Promise<void>
    /** Hands a never-created report back to pending so a later attempt may create it. */
    release(claim: C): Promise<void>
}): Promise<
    | { kind: "open"; threadId: string }
    | { kind: "busy" | "blocked" | "uncertain" }
> {
    const claim = await ports.claim()
    if (claim.kind !== "claimed") return claim
    let createAttempted = false
    try {
        let threadId = await ports.find(claim)
        if (!threadId) {
            if (!claim.canCreate) {
                await ports.uncertain(claim)
                return { kind: "uncertain" }
            }
            createAttempted = true
            threadId = await ports.create(claim)
        }
        await ports.bind(claim, threadId)
        await ports.preparePrivateThread(claim, threadId)
        // Revalidate configuration again before writing the report content.
        await ports.bind(claim, threadId)
        const messageId = await ports.starter(claim, threadId)
        await ports.complete(claim, messageId)
        return { kind: "open", threadId }
    } catch {
        // A failure before any Discord create (staff lookup, parent fetch) left nothing
        // to reconcile; only an attempted create is genuinely uncertain.
        if (!createAttempted && claim.canCreate && !claim.threadId) {
            await ports.release(claim).catch(() => {})
            return { kind: "busy" }
        }
        await ports.uncertain(claim).catch(() => {})
        return { kind: "uncertain" }
    }
}
