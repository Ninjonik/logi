import { fetchDiscordMembership } from "@/infrastructure/discord/membership"
import { readMembership } from "@/application/membership/read-membership"
import type { MembershipSubject } from "@/domain/membership/observation"
import { getDiscordBotToken, getInternalAuthSecret } from "./env"
import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"
import { createHash } from "node:crypto"

export async function getMembershipObservation(
    key: string,
    subject: MembershipSubject,
    maxAgeMs: number
) {
    const credentials = {
        secret: getInternalAuthSecret(),
        keyHash: createHash("sha256").update(key).digest("hex"),
    }
    return readMembership(subject, maxAgeMs, {
        prepare: (subject, maxAgeMs) =>
            fetchMutation(
                makeFunctionReference<"mutation">(
                    "memberObservations:prepareLookup"
                ),
                { ...credentials, ...subject, maxAgeMs }
            ),
        refresh: (subject) =>
            fetchDiscordMembership(subject, { token: getDiscordBotToken() }),
        complete: (subject, token, result, maxAgeMs) =>
            fetchMutation(
                makeFunctionReference<"mutation">(
                    "memberObservations:completeLookup"
                ),
                { ...credentials, ...subject, token, result, maxAgeMs }
            ),
    })
}
