/**
 * Turns a claimed, complete application into its private thread (L6-B04,
 * L4-B02): the membership first, then the thread, its people, the record
 * with the application number, the intro and the card. A failure before the
 * record exists leaves nothing behind (no thread, no membership); later
 * steps are best effort because the application already exists.
 */

export type SubmitApplicationStep =
    | "assignment"
    | "thread"
    | "members"
    | "record"
    | "intro"
    | "card"
    | "accounts"

export type SubmitApplicationPorts = {
    /** Creates the pending (or recruit) membership; null when it failed. */
    createAssignment(): Promise<string | null>
    removeAssignment(assignmentId: string): Promise<void>
    createThread(): Promise<{ id: string } | null>
    deleteThread(threadId: string): Promise<void>
    addMembers(threadId: string): Promise<void>
    /** Stores the application and returns its number; null when it failed. */
    recordApplication(input: {
        threadId: string
        assignmentId: string
    }): Promise<{ number: number } | null>
    sendIntro(threadId: string): Promise<boolean>
    /** Posts the card and returns its message ID (kept for edits in place). */
    sendCard(threadId: string, number: number): Promise<string | null>
    storeCardMessage(threadId: string, messageId: string): Promise<void>
    /** Self-declared accounts join the applicant's linked accounts. */
    linkAccounts(): Promise<void>
    /** An admin-fixable failure for the errors channel. */
    report(step: SubmitApplicationStep, error: unknown): void
}

export type SubmitApplicationResult =
    | { ok: true; threadId: string; number: number }
    | { ok: false; failedAt: "assignment" | "thread" | "record" }

async function attempt<T>(
    ports: SubmitApplicationPorts,
    step: SubmitApplicationStep,
    work: () => Promise<T>,
    fallback: T
): Promise<T> {
    try {
        return await work()
    } catch (error) {
        ports.report(step, error)
        return fallback
    }
}

export async function submitApplication(
    ports: SubmitApplicationPorts
): Promise<SubmitApplicationResult> {
    const assignmentId = await attempt(
        ports,
        "assignment",
        () => ports.createAssignment(),
        null
    )
    if (!assignmentId) return { ok: false, failedAt: "assignment" }

    const thread = await attempt(
        ports,
        "thread",
        () => ports.createThread(),
        null
    )
    if (!thread) {
        await attempt(
            ports,
            "assignment",
            () => ports.removeAssignment(assignmentId),
            undefined
        )
        return { ok: false, failedAt: "thread" }
    }

    await attempt(
        ports,
        "members",
        () => ports.addMembers(thread.id),
        undefined
    )

    const record = await attempt(
        ports,
        "record",
        () => ports.recordApplication({ threadId: thread.id, assignmentId }),
        null
    )
    if (!record) {
        await attempt(
            ports,
            "thread",
            () => ports.deleteThread(thread.id),
            undefined
        )
        await attempt(
            ports,
            "assignment",
            () => ports.removeAssignment(assignmentId),
            undefined
        )
        return { ok: false, failedAt: "record" }
    }

    await attempt(ports, "intro", () => ports.sendIntro(thread.id), false)
    const cardId = await attempt(
        ports,
        "card",
        () => ports.sendCard(thread.id, record.number),
        null
    )
    if (cardId)
        await attempt(
            ports,
            "card",
            () => ports.storeCardMessage(thread.id, cardId),
            undefined
        )
    await attempt(ports, "accounts", () => ports.linkAccounts(), undefined)
    return { ok: true, threadId: thread.id, number: record.number }
}
