import { createHash } from "node:crypto"

import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import { validateIdempotencyKey } from "@/domain/api/idempotency"
import { getInternalAuthSecret } from "@/lib/env"

const reserveReference = makeFunctionReference<"mutation">(
    "publicApi:reserveIdempotencyKey"
)
const completeReference = makeFunctionReference<"mutation">(
    "publicApi:completeIdempotencyKey"
)

export async function reserveIdempotentRequest(input: {
    guildId: string
    methodPath: string
    key: string | null
    body: string
}) {
    const error = validateIdempotencyKey(input.key)
    if (error) return { kind: "invalid" as const, error }
    return (await fetchMutation(reserveReference, {
        secret: getInternalAuthSecret(),
        guildId: input.guildId,
        key: input.key,
        methodPath: input.methodPath,
        bodyHash: createHash("sha256").update(input.body).digest("hex"),
    })) as
        | { kind: "conflict" }
        | { kind: "replay"; status: number; body: string }
        | { kind: "reserved"; id: string }
}

export const completeIdempotentRequest = (
    id: string,
    status: number,
    body: string
) =>
    fetchMutation(completeReference, {
        secret: getInternalAuthSecret(),
        id: id as never,
        status,
        body,
    })
