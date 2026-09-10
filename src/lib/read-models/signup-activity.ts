import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import { getLoggedInUser } from "@/lib/auth"

const listSignupActivityReference = makeFunctionReference<"query">(
    "signupActivity:list"
)

export type SignupActivity = {
    id: string
    eventId: string
    eventName: string
    eventKind: "match" | "training"
    userId: string
    action: "signed_up" | "changed_role" | "unsigned" | "declined"
    role?: string | null
    previousRole?: string | null
    occurredAt: string
}

export async function getSignupActivity(
    serverId: string,
    eventId?: string
): Promise<SignupActivity[]> {
    const user = await getLoggedInUser()
    if (!user) return []

    return (await fetchQuery(listSignupActivityReference, {
        serverId: serverId as never,
        userId: user.discordId,
        eventId: eventId as never,
    })) as SignupActivity[]
}
