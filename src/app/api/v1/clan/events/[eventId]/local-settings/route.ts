import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { sharedMatchSettingsSchema } from "@/lib/validation/shared-match-settings"
import { clanMutationResponse } from "@/lib/gateways/clan-write-cache"
import { validateIdempotencyKey } from "@/domain/api/idempotency"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchMutation } from "convex/nextjs"
import { createHash } from "node:crypto"

export const runtime = "nodejs"

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const idempotencyKey = request.headers.get("idempotency-key")
    const invalid = validateIdempotencyKey(idempotencyKey)
    const error = (message: string, status: number) =>
        Response.json(
            { error: { code: "validation_error", message } },
            { status, headers: auth.headers }
        )
    if (invalid || !idempotencyKey)
        return error(invalid ?? "Idempotency-Key is required.", 400)
    const raw = await request.text()
    if (raw.length > 64 * 1024) return error("Request body too large.", 413)
    let settings: unknown
    try {
        settings = sharedMatchSettingsSchema.parse(JSON.parse(raw))
    } catch {
        return error("Invalid local match settings.", 400)
    }
    const { eventId } = await params
    const result = await fetchMutation(
        makeFunctionReference<"mutation">("sharedMatchApi:configureLocal"),
        {
            secret: getInternalAuthSecret(),
            keyHash: hashApiKey(auth.key),
            eventId,
            idempotencyKey,
            bodyHash: createHash("sha256").update(raw).digest("hex"),
            methodPath: `PATCH /clan/events/${eventId}/local-settings`,
            settings,
        }
    )
    return result
        ? clanMutationResponse(result, auth)
        : error("The API key is invalid or revoked.", 401)
}
