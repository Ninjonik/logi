import {
    createResultRevision,
    type ResultActor,
    type ResultCommand,
    type ResultDraft,
    type ResultRevision,
} from "../../domain/match-results/result-revision"

export type ResultPorts = {
    authorize(actor: ResultActor, eventId: string): Promise<void>
    current(): Promise<ResultRevision | null>
    draft(input: ResultCommand): Promise<ResultDraft>
    refresh(draft: ResultDraft): Promise<ResultDraft>
    append(expected: number, revision: ResultRevision): Promise<ResultRevision>
    now(): string
}
export async function confirmResult(
    input: ResultCommand & { eventId: string; actor: ResultActor },
    ports: ResultPorts
) {
    await ports.authorize(input.actor, input.eventId)
    const previous = await ports.current()
    if ((previous?.version ?? 0) !== input.expectedRevision)
        throw new Error("Result revision conflict. Refresh before saving.")
    if (input.action === "confirm" && !previous)
        throw new Error("No provisional result.")
    const draft =
        input.action === "confirm"
            ? await ports.refresh({
                  origin: previous!.origin,
                  participants: previous!.participants,
                  sessionLinks: previous!.sessionLinks,
                  players: previous!.players,
              })
            : await ports.draft(input)
    const revision = createResultRevision({
        previous,
        expectedRevision: input.expectedRevision,
        draft,
        action: input.action,
        actor: input.actor,
        now: ports.now(),
        reason: input.reason,
    })
    await ports.authorize(input.actor, input.eventId)
    return ports.append(input.expectedRevision, revision)
}
