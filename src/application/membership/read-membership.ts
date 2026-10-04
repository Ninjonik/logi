import {
    membershipObservationSchema,
    type MembershipObservation,
    type MembershipSubject,
    type ProviderObservation,
} from "@/domain/membership/observation"

export type ObservationFence = {
    epoch: string
    revision: string
    fence: number
    policyVersion: string
    startedAt: string
}
export type PreparedMembership =
    | { kind: "cached"; data: MembershipObservation }
    | { kind: "refresh"; token: ObservationFence }
export type MembershipReadPorts = {
    prepare(
        subject: MembershipSubject,
        maxAgeMs: number
    ): Promise<PreparedMembership | null>
    refresh(subject: MembershipSubject): Promise<ProviderObservation>
    complete(
        subject: MembershipSubject,
        token: ObservationFence,
        result: ProviderObservation,
        maxAgeMs: number
    ): Promise<MembershipObservation | null>
}
export async function readMembership(
    subject: MembershipSubject,
    maxAgeMs: number,
    ports: MembershipReadPorts
): Promise<MembershipObservation | null> {
    const prepared = await ports.prepare(subject, maxAgeMs)
    if (!prepared) return null
    const validate = (value: unknown) => {
        const data = membershipObservationSchema.parse(value)
        if (
            data.guildId !== subject.guildId ||
            data.gameId !== subject.gameId ||
            data.discordUserId !== subject.discordUserId
        )
            throw new Error("Membership subject mismatch.")
        return data
    }
    if (prepared.kind === "cached") return validate(prepared.data)
    let result: ProviderObservation
    try {
        result = await ports.refresh(subject)
    } catch {
        result = { state: "unknown", roleIds: [], observedAt: null }
    }
    // Authority is checked by the repository after the awaited provider read.
    const completed = await ports.complete(
        subject,
        prepared.token,
        result,
        maxAgeMs
    )
    if (!completed) return null
    return validate(completed)
}
export async function applyObservation(
    input: ProviderObservation,
    expectedFence: ObservationFence,
    repository: {
        compareAndSet(
            input: ProviderObservation,
            fence: ObservationFence
        ): Promise<boolean>
    }
): Promise<"applied" | "superseded"> {
    return (await repository.compareAndSet(input, expectedFence))
        ? "applied"
        : "superseded"
}
