import {
    websiteEventCommandSchema,
    websiteEventEditorSchema,
    websiteEventGameSchema,
    websiteEventIdSchema,
    websiteEventKeySchema,
    websiteEventReceiptSchema,
    type WebsiteEventCommand,
    type WebsiteEventGame,
} from "../../domain/events/website-command"
import { isSsoOpaqueValue } from "../../domain/identity/sso-policy"
import { createHash } from "node:crypto"

const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    Pragma: "no-cache",
}
const failure = (code: string, status: number) =>
    Response.json({ error: { code } }, { status, headers })
export type WebsiteEventRouteInput = {
    keyHash: string
    actorTokenHash: string
    gameId: WebsiteEventGame
}
export type WebsiteEventRoutePorts = {
    rateLimit(
        bucket: string
    ): Promise<{ allowed: boolean; retryAfterSeconds: number }>
    execute(
        input: WebsiteEventRouteInput & {
            idempotencyKey: string
            command: WebsiteEventCommand
        }
    ): Promise<unknown>
    editor(
        input: WebsiteEventRouteInput & { eventId: string }
    ): Promise<unknown>
}
const hash = (input: string) => createHash("sha256").update(input).digest("hex")

export async function readWebsiteCommandBody(request: Request) {
    const length = request.headers.get("content-length")
    if (
        request.headers
            .get("content-type")
            ?.split(";")[0]
            .trim()
            .toLowerCase() !== "application/json" ||
        !request.body ||
        (length !== null && (!/^\d+$/.test(length) || Number(length) > 16_384))
    )
        throw new Error("Invalid body")
    const reader = request.body.getReader()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            (async () => {
                const chunks: Uint8Array[] = []
                let size = 0
                while (true) {
                    const chunk = await reader.read()
                    if (chunk.done) break
                    size += chunk.value.byteLength
                    if (size > 16_384) throw new Error("Invalid body")
                    chunks.push(chunk.value)
                }
                const bytes = new Uint8Array(size)
                let offset = 0
                for (const chunk of chunks) {
                    bytes.set(chunk, offset)
                    offset += chunk.byteLength
                }
                return JSON.parse(
                    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
                ) as unknown
            })(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Invalid body")),
                    5000
                )
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
        void reader.cancel().catch(() => undefined)
    }
}

function response(value: unknown, created: boolean, editor = false): Response {
    if (!value || typeof value !== "object") return failure("unavailable", 503)
    if ("error" in value) {
        const code =
            value.error &&
            typeof value.error === "object" &&
            "code" in value.error
                ? value.error.code
                : null
        const statuses: Record<string, number> = {
            invalid_request: 400,
            invalid_match_teams: 400,
            unauthorized: 401,
            insufficient_scope: 403,
            policy_denied: 403,
            membership_denied: 403,
            not_found: 404,
            revision_conflict: 409,
            idempotency_conflict: 409,
            invalid_state: 409,
            membership_stale: 503,
        }
        return typeof code === "string" && statuses[code]
            ? failure(code, statuses[code])
            : failure("unavailable", 503)
    }
    if (!("data" in value) || Object.keys(value).length !== 1)
        return failure("unavailable", 503)
    const parsed = (
        editor ? websiteEventEditorSchema : websiteEventReceiptSchema
    ).safeParse(value.data)
    return parsed.success
        ? Response.json(
              { data: parsed.data },
              { status: created ? 201 : 200, headers }
          )
        : failure("unavailable", 503)
}

export function websiteEventCommandHandlers(ports: WebsiteEventRoutePorts) {
    async function authorize(
        request: Request
    ): Promise<WebsiteEventRouteInput | Response> {
        const url = new URL(request.url)
        const game = websiteEventGameSchema.safeParse(
            url.searchParams.get("game")
        )
        if (
            !game.success ||
            url.searchParams.getAll("game").length !== 1 ||
            [...url.searchParams.keys()].some((key) => key !== "game")
        )
            return failure("invalid_request", 400)
        const key = /^Bearer ([\x21-\x7e]{16,1024})$/.exec(
            request.headers.get("authorization") ?? ""
        )?.[1]
        const actor = request.headers.get("x-logi-actor-token") ?? ""
        if (!key || !isSsoOpaqueValue(actor))
            return failure("unauthorized", 401)
        const keyHash = hash(key)
        const rate = await ports.rateLimit(`website-event-command:${keyHash}`)
        if (!rate.allowed)
            return Response.json(
                { error: { code: "rate_limited" } },
                {
                    status: 429,
                    headers: {
                        ...headers,
                        "Retry-After": String(
                            Math.max(1, Math.ceil(rate.retryAfterSeconds))
                        ),
                    },
                }
            )
        return { keyHash, actorTokenHash: hash(actor), gameId: game.data }
    }
    return {
        async POST(request: Request): Promise<Response> {
            try {
                const actor = await authorize(request)
                if (actor instanceof Response) return actor
                const key = websiteEventKeySchema.safeParse(
                    request.headers.get("idempotency-key")
                )
                if (!key.success) return failure("invalid_request", 400)
                let raw: unknown
                try {
                    raw = await readWebsiteCommandBody(request)
                } catch {
                    return failure("invalid_request", 400)
                }
                const command = websiteEventCommandSchema.safeParse(raw)
                if (!command.success) return failure("invalid_request", 400)
                return response(
                    await ports.execute({
                        ...actor,
                        idempotencyKey: key.data,
                        command: command.data,
                    }),
                    command.data.operation === "create"
                )
            } catch {
                return failure("unavailable", 503)
            }
        },
        async GET(request: Request, eventId: string): Promise<Response> {
            try {
                const actor = await authorize(request)
                if (actor instanceof Response) return actor
                if (!websiteEventIdSchema.safeParse(eventId).success)
                    return failure("invalid_request", 400)
                return response(
                    await ports.editor({ ...actor, eventId }),
                    false,
                    true
                )
            } catch {
                return failure("unavailable", 503)
            }
        },
    }
}
