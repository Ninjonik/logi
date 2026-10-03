import type { SsoProfile } from "../../domain/identity/sso-policy"
import { isSsoCallback } from "../../domain/identity/sso-policy"
import { importJWK, jwtVerify, SignJWT, type JWK } from "jose"

export async function configureSsoSigning(environment: {
    issuer: string
    privateJwk: string
    allowLoopbackHttp: boolean
}) {
    const { issuer } = environment
    if (
        !isSsoCallback(issuer, environment.allowLoopbackHttp) ||
        new URL(issuer).origin !== issuer
    )
        throw new Error("Invalid provider configuration.")
    const input: unknown = JSON.parse(environment.privateJwk)
    if (!input || typeof input !== "object")
        throw new Error("Invalid signing key.")
    const jwk = input as JWK
    if (
        jwk.kty !== "RSA" ||
        (jwk.alg !== undefined && jwk.alg !== "RS256") ||
        (jwk.use !== undefined && jwk.use !== "sig") ||
        typeof jwk.kid !== "string" ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(jwk.kid) ||
        typeof jwk.d !== "string" ||
        !jwk.d ||
        typeof jwk.n !== "string" ||
        !/^[A-Za-z0-9_-]+$/.test(jwk.n) ||
        Buffer.from(jwk.n, "base64url").length < 256 ||
        Buffer.from(jwk.n, "base64url").length > 1024 ||
        typeof jwk.e !== "string"
    )
        throw new Error("Invalid signing key.")
    const key = await importJWK({ ...jwk, alg: "RS256", use: "sig" }, "RS256")
    const publicJwk = {
        kty: "RSA",
        kid: jwk.kid,
        alg: "RS256",
        use: "sig",
        n: jwk.n,
        e: jwk.e,
    }
    const publicKey = await importJWK(publicJwk, "RS256")
    // Validate the configured pair before enabling discovery or issuing any grant.
    const proof = await new SignJWT({ configurationCheck: true })
        .setProtectedHeader({ alg: "RS256" })
        .sign(key)
    await jwtVerify(proof, publicKey, { algorithms: ["RS256"] })
    return {
        issuer,
        allowLoopbackHttp: environment.allowLoopbackHttp,
        jwks: { keys: [publicJwk] },
        sign: (
            profile: SsoProfile & {
                nonce: string
                issuedAt: number
                expiresAt: number
            },
            clientId: string
        ) =>
            new SignJWT({
                nonce: profile.nonce,
                sid: profile.sid,
                guild_id: profile.guild_id,
                name: profile.name,
                picture: profile.picture,
            })
                .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: jwk.kid })
                .setIssuer(issuer)
                .setAudience(clientId)
                .setSubject(profile.sub)
                .setIssuedAt(Math.floor(profile.issuedAt / 1000))
                .setExpirationTime(Math.floor(profile.expiresAt / 1000))
                .sign(key),
    }
}
