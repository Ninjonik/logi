import {
    websiteEventCommandSchema,
    websiteEventGameSchema,
    websiteEventKeySchema,
    websiteEventStateError,
    type WebsiteEventActor,
    type WebsiteEventCommand,
    type WebsiteEventError,
    type WebsiteEventGame,
    type WebsiteEventReceipt,
    type WebsiteEventResult,
} from "../../domain/events/website-command"
import type { EventStatus } from "../../domain/events/types"

export type WebsiteCommandEvent = {
    id: string
    guildId: string
    gameId: string
    revision: string
    kind?: string
    status?: EventStatus
    registrationEnd: string
    meetingStart: string
    gameEnd: string
}
export interface WebsiteEventCommandPorts {
    /** Called inside the same transaction as the write and receipt. */
    authorize(
        gameId: WebsiteEventGame
    ): Promise<{ actor: WebsiteEventActor } | { error: WebsiteEventError }>
    receipt(
        actor: WebsiteEventActor,
        gameId: WebsiteEventGame,
        key: string
    ): Promise<{ bodyHash: string; receipt: WebsiteEventReceipt } | null>
    event(id: string): Promise<WebsiteCommandEvent | null>
    /**
     * Must run the native event workflow and tracked changes in this
     * transaction. A returned error means nothing was written.
     */
    apply(
        actor: WebsiteEventActor,
        gameId: WebsiteEventGame,
        command: WebsiteEventCommand
    ): Promise<
        { eventId: string; revision: string } | { error: WebsiteEventError }
    >
    record(
        actor: WebsiteEventActor,
        gameId: WebsiteEventGame,
        key: string,
        bodyHash: string,
        operation: WebsiteEventCommand["operation"],
        result: { eventId: string; revision: string }
    ): Promise<string>
    now(): number
}

/** The adapter supplies one serializable transaction; never catch a partial write. */
export async function executeWebsiteEventCommand(
    ports: WebsiteEventCommandPorts,
    input: {
        gameId: unknown
        command: unknown
        idempotencyKey: unknown
        bodyHash: string
    }
): Promise<WebsiteEventResult> {
    const game = websiteEventGameSchema.safeParse(input.gameId)
    const command = websiteEventCommandSchema.safeParse(input.command)
    const key = websiteEventKeySchema.safeParse(input.idempotencyKey)
    if (
        !game.success ||
        !command.success ||
        !key.success ||
        !/^[a-f0-9]{64}$/.test(input.bodyHash)
    )
        return { error: { code: "invalid_request" } }
    const permission = await ports.authorize(game.data)
    if ("error" in permission) return { error: { code: permission.error } }
    const actor = permission.actor
    const prior = await ports.receipt(actor, game.data, key.data)
    if (prior)
        return prior.bodyHash === input.bodyHash
            ? { data: { ...prior.receipt, replayed: true } }
            : { error: { code: "idempotency_conflict" } }
    const current =
        command.data.operation === "create"
            ? null
            : await ports.event(command.data.eventId)
    if (
        command.data.operation !== "create" &&
        (!current ||
            current.guildId !== actor.guildId ||
            current.gameId !== game.data)
    )
        return { error: { code: "not_found" } }
    if (
        command.data.operation !== "create" &&
        current?.revision !== command.data.expectedRevision
    )
        return { error: { code: "revision_conflict" } }
    const state = websiteEventStateError(command.data, current, ports.now())
    if (state) return { error: { code: state } }
    const result = await ports.apply(actor, game.data, command.data)
    if ("error" in result) return { error: { code: result.error } }
    const receiptId = await ports.record(
        actor,
        game.data,
        key.data,
        input.bodyHash,
        command.data.operation,
        result
    )
    return {
        data: {
            ...result,
            receiptId,
            guildId: actor.guildId,
            gameId: game.data,
            operation: command.data.operation,
            replayed: false,
        },
    }
}
