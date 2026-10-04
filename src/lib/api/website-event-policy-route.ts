import {
    websiteEventIdSchema,
    websiteEventPolicyInputSchema,
    websiteEventPolicyResultSchema,
    websiteEventPolicyListSchema,
    type WebsiteEventPolicyInput,
} from "../../domain/events/website-command"
import { readWebsiteCommandBody } from "./website-event-command-route"

type Ports = {
    origin: string
    session(): Promise<{ sid: string } | null>
    configure(
        sid: string,
        workspaceId: string,
        input: WebsiteEventPolicyInput
    ): Promise<unknown>
    list(
        sid: string,
        workspaceId: string,
        applicationRecordId: string
    ): Promise<unknown>
}
const json = (value: unknown, status = 200) =>
    Response.json(value, {
        status,
        headers: {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    })
const failure = (code: string, status: number) =>
    json({ error: { code } }, status)
function response(value: unknown, list: boolean) {
    if (value && typeof value === "object") {
        if (
            "error" in value &&
            value.error &&
            typeof value.error === "object" &&
            "code" in value.error
        ) {
            if (value.error.code === "policy_denied")
                return failure("policy_denied", 403)
            if (value.error.code === "invalid_request")
                return failure("invalid_request", 400)
        }
        if ("data" in value && Object.keys(value).length === 1) {
            const data = (
                list
                    ? websiteEventPolicyListSchema
                    : websiteEventPolicyResultSchema
            ).safeParse(value.data)
            if (data.success) return json({ data: data.data })
        }
    }
    return failure("unavailable", 503)
}

export function websiteEventPolicyHandlers(ports: Ports) {
    return {
        async GET(request: Request, workspaceId: string) {
            try {
                const url = new URL(request.url)
                const app = websiteEventIdSchema.safeParse(
                    url.searchParams.get("applicationRecordId")
                )
                if (
                    !websiteEventIdSchema.safeParse(workspaceId).success ||
                    !app.success ||
                    url.searchParams.getAll("applicationRecordId").length !==
                        1 ||
                    [...url.searchParams.keys()].some(
                        (key) => key !== "applicationRecordId"
                    )
                )
                    return failure("invalid_request", 400)
                const session = await ports.session()
                if (!session) return failure("unauthorized", 401)
                return response(
                    await ports.list(session.sid, workspaceId, app.data),
                    true
                )
            } catch {
                return failure("unavailable", 503)
            }
        },
        async POST(request: Request, workspaceId: string) {
            try {
                const url = new URL(request.url)
                if (
                    request.headers.get("origin") !== ports.origin ||
                    request.headers.get("sec-fetch-site") === "cross-site"
                )
                    return failure("policy_denied", 403)
                if (
                    !websiteEventIdSchema.safeParse(workspaceId).success ||
                    url.search
                )
                    return failure("invalid_request", 400)
                const session = await ports.session()
                if (!session) return failure("unauthorized", 401)
                let raw: unknown
                try {
                    raw = await readWebsiteCommandBody(request)
                } catch {
                    return failure("invalid_request", 400)
                }
                const input = websiteEventPolicyInputSchema.safeParse(raw)
                if (!input.success) return failure("invalid_request", 400)
                // Current durable session and workspace admin authority are checked again
                // by configurePolicy in the same transaction as the policy/key update.
                return response(
                    await ports.configure(session.sid, workspaceId, input.data),
                    false
                )
            } catch {
                return failure("unavailable", 503)
            }
        },
    }
}
