import {
    isPkceVerifier,
    SSO_ACCESS_TOKEN_TTL_MS,
    validSsoGrant,
    ssoProfile,
    type SsoGrant,
} from "../../domain/identity/sso-policy"

export type SsoRedemptionInput = {
    clientId: string
    clientSecretHash: string
    codeHash: string
    redirectUri: string
    verifier: string
    tokenHash: string
}
/** The adapter must run every port within one database transaction. */
export async function redeemSsoCode(
    ports: {
        now(): number
        load(input: SsoRedemptionInput): Promise<SsoGrant | null>
        challenge(verifier: string): Promise<string>
        consumeAndIssue(
            grant: SsoGrant,
            input: SsoRedemptionInput,
            now: number,
            expiresAt: number
        ): Promise<void>
    },
    input: SsoRedemptionInput
) {
    if (!isPkceVerifier(input.verifier)) return null
    const now = ports.now()
    const grant = await ports.load(input)
    if (
        !grant ||
        !validSsoGrant(
            grant,
            { ...input, challenge: await ports.challenge(input.verifier) },
            now
        )
    )
        return null
    const expiresAt = Math.min(
        now + SSO_ACCESS_TOKEN_TTL_MS,
        grant.session.expiresAt
    )
    await ports.consumeAndIssue(grant, input, now, expiresAt)
    return {
        ...ssoProfile({
            subject: grant.session.subject,
            sid: grant.session.sid,
            name: grant.user.name,
            avatar: grant.user.avatar,
            guildId: grant.guildId,
        }),
        nonce: grant.code.nonce!,
        scope: grant.code.scope!,
        issuedAt: now,
        expiresAt,
    }
}
