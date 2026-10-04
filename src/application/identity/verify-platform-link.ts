import {
    assertLinkChallenge,
    LINK_TTL_MS,
    steamCallbackUrl,
    type LinkActorSession,
    type LinkChallenge,
    type LinkLocale,
    type VerifiedPlatformLink,
} from "../../domain/identity/platform-link"

export type PlatformLinkPorts = {
    now(): number
    randomState(): string
    hash(value: string): string
    create(
        input: LinkActorSession & {
            tokenHash: string
            returnOrigin: string
            locale: LinkLocale
            expiresAt: number
        }
    ): Promise<void>
    claim(
        input: LinkActorSession & { tokenHash: string }
    ): Promise<LinkChallenge>
    verify(
        parameters: URLSearchParams,
        expectedReturn: string
    ): Promise<{ platformId: string; nonce: string }>
    complete(
        input: LinkActorSession & {
            challengeId: string
            platformId: string
            nonceHash: string
        }
    ): Promise<VerifiedPlatformLink>
    fail(input: LinkActorSession & { challengeId: string }): Promise<void>
    redirect(returnUrl: string): string
}
export async function beginSteamLink(
    actor: LinkActorSession,
    returnOrigin: string,
    ports: PlatformLinkPorts,
    locale: LinkLocale = "en"
) {
    const state = ports.randomState()
    const callback = steamCallbackUrl(returnOrigin, state)
    await ports.create({
        ...actor,
        tokenHash: ports.hash(state),
        returnOrigin,
        locale,
        expiresAt: ports.now() + LINK_TTL_MS,
    })
    return { redirectUrl: ports.redirect(callback) }
}
export async function verifySteamLink(
    parameters: URLSearchParams,
    actor: LinkActorSession,
    ports: PlatformLinkPorts
) {
    const state = parameters.get("state") ?? ""
    if (parameters.getAll("state").length !== 1 || !/^[\w-]{43}$/.test(state))
        throw new Error("Steam challenge unavailable.")
    // Atomically claim before network verification. Failures require a new challenge.
    const challenge = await ports.claim({
        ...actor,
        tokenHash: ports.hash(state),
    })
    try {
        assertLinkChallenge(challenge, actor, ports.now(), "verifying")
        const assertion = await ports.verify(
            parameters,
            steamCallbackUrl(challenge.returnOrigin, state)
        )
        assertLinkChallenge(challenge, actor, ports.now(), "verifying")
        const link = await ports.complete({
            ...actor,
            challengeId: challenge.id,
            platformId: assertion.platformId,
            nonceHash: ports.hash(assertion.nonce),
        })
        return { link, locale: challenge.locale }
    } catch {
        await ports
            .fail({ ...actor, challengeId: challenge.id })
            .catch(() => undefined)
        throw new Error("Steam verification failed. Start a new link attempt.")
    }
}
