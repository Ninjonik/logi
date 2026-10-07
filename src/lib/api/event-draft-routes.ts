import { z } from "zod"

import {
    eventDraftSchema,
    eventPublishSchema,
    type EventDraftParsed,
} from "@/lib/validation/event-flow"
import type { EventDraftWriteResult } from "@/lib/gateways/event-drafts"
import { matchTeamErrorCode } from "@/lib/api/event-route-handlers"

const MAX_BODY_BYTES = 64 * 1024
const eventId = z.string().regex(/^[a-z0-9]{10,64}$/)

/** One write of the new-match flow: save the draft, or publish it. */
export const eventFlowWriteSchema = z.strictObject({
    eventId: eventId.optional(),
    publish: z.boolean().default(false),
    event: z.unknown(),
})

type Deps = {
    /** Origin, live session and current clan admin; denial happens before the body is read. */
    denied: (request: Request, serverId: string) => Promise<Response | null>
    readJson: (request: Request, maxBytes: number) => Promise<unknown>
    saveDraft: (
        serverId: string,
        eventId: string | undefined,
        input: EventDraftParsed
    ) => Promise<EventDraftWriteResult>
    publish: (
        serverId: string,
        eventId: string | undefined,
        input: EventDraftParsed
    ) => Promise<EventDraftWriteResult>
    remove: (
        serverId: string,
        eventId: string
    ) => Promise<EventDraftWriteResult>
    revalidate: (serverId: string, eventId: string) => void
    logError: (scope: string, error: unknown) => void
}

const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

function resultResponse(result: EventDraftWriteResult) {
    if (result.ok) return json(result)
    return json(result, result.error === "not_found" ? 404 : 409)
}

/** POST `/api/servers/[serverId]/event-drafts`: autosave, save or publish. */
export function createEventFlowWriteHandler(deps: Deps) {
    return async function POST(
        request: Request,
        { params }: { params: Promise<{ serverId: string }> }
    ) {
        const { serverId } = await params
        const denied = await deps.denied(request, serverId)
        if (denied) return denied
        const body = eventFlowWriteSchema.safeParse(
            await deps.readJson(request, MAX_BODY_BYTES)
        )
        if (!body.success) return json({ error: "invalid_request" }, 400)
        const event = (
            body.data.publish ? eventPublishSchema : eventDraftSchema
        ).safeParse(body.data.event)
        if (!event.success)
            return json(
                {
                    error: "invalid_event",
                    fields: [
                        ...new Set(
                            event.error.issues.map((issue) =>
                                String(issue.path[0] ?? "")
                            )
                        ),
                    ].filter(Boolean),
                },
                400
            )
        try {
            const result = await (
                body.data.publish ? deps.publish : deps.saveDraft
            )(serverId, body.data.eventId, event.data)
            if (result.ok) deps.revalidate(serverId, result.eventId)
            return resultResponse(result)
        } catch (error) {
            const teamError = matchTeamErrorCode(error)
            if (teamError) return json({ error: teamError }, 400)
            deps.logError(
                body.data.publish ? "eventDrafts.publish" : "eventDrafts.save",
                error
            )
            return json({ error: "save_failed" }, 503)
        }
    }
}

/** DELETE `/api/servers/[serverId]/event-drafts/[eventId]`: discard a draft. */
export function createEventDraftDeleteHandler(deps: Deps) {
    return async function DELETE(
        request: Request,
        { params }: { params: Promise<{ serverId: string; eventId: string }> }
    ) {
        const { serverId, eventId: rawId } = await params
        const denied = await deps.denied(request, serverId)
        if (denied) return denied
        const parsed = eventId.safeParse(rawId)
        if (!parsed.success) return json({ error: "not_found" }, 404)
        try {
            const result = await deps.remove(serverId, parsed.data)
            if (result.ok) deps.revalidate(serverId, result.eventId)
            return resultResponse(result)
        } catch (error) {
            deps.logError("eventDrafts.remove", error)
            return json({ error: "delete_failed" }, 503)
        }
    }
}
