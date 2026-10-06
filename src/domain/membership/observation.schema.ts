import {
    isFreshObservation,
    type MembershipSubject,
    type StoredObservation,
} from "./observation"
import { GAME_IDS } from "../games/game"
import { z } from "zod"

export const membershipObservationSchema = z
    .object({
        guildId: z.string(),
        discordUserId: z.string(),
        gameId: z.enum(GAME_IDS),
        state: z.enum(["present", "left", "unknown"]),
        roleIds: z.array(z.string()),
        assignment: z
            .object({
                type: z.enum(["member", "reserve_member", "mercenary"]),
                status: z.enum(["pending", "recruit", "active"]),
            })
            .strict()
            .nullable(),
        observedAt: z.string().nullable(),
        receivedAt: z.string().nullable(),
        epoch: z.string().regex(/^(0|[1-9][0-9]{0,127})$/),
        revision: z.string().regex(/^(0|[1-9][0-9]{0,127})$/),
        completeness: z.enum([
            "verified_member",
            "verified_absent",
            "unavailable",
        ]),
    })
    .strict()
export type MembershipObservation = z.infer<typeof membershipObservationSchema>
export function projectMembership(
    subject: MembershipSubject,
    value: StoredObservation | null,
    input: {
        epoch: string
        revision: string
        allowedRoleIds: string[]
        assignment: MembershipObservation["assignment"]
        maxAgeMs: number
        now: number
    }
): MembershipObservation {
    const state = isFreshObservation(
        value,
        input.epoch,
        input.maxAgeMs,
        input.now
    )
        ? value!.state
        : "unknown"
    return membershipObservationSchema.parse({
        ...subject,
        state,
        roleIds:
            state === "present"
                ? [
                      ...new Set(
                          value!.roleIds.filter((role) =>
                              input.allowedRoleIds.includes(role)
                          )
                      ),
                  ].sort()
                : [],
        assignment: input.assignment,
        observedAt: value?.observedAt ?? null,
        receivedAt: value?.receivedAt ?? null,
        epoch: input.epoch,
        revision: input.revision,
        completeness:
            state === "present"
                ? "verified_member"
                : state === "left"
                  ? "verified_absent"
                  : "unavailable",
    })
}
