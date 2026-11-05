import { createPrivateKey, sign } from "node:crypto"
import { z } from "zod"

export function githubConfig(
    environment: Readonly<Record<string, string | undefined>> = process.env
) {
    const repository = environment.LOGI_GITHUB_REPOSITORY
    const appId = environment.LOGI_GITHUB_APP_ID
    const installationId = environment.LOGI_GITHUB_INSTALLATION_ID
    const privateKey = environment.LOGI_GITHUB_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n"
    )
    if (![repository, appId, installationId, privateKey].some(Boolean))
        return null
    if (
        !repository ||
        !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
        !appId ||
        !/^[1-9]\d*$/.test(appId) ||
        !installationId ||
        !/^[1-9]\d*$/.test(installationId) ||
        !privateKey
    )
        throw new Error(
            "Configure LOGI_GITHUB_REPOSITORY, LOGI_GITHUB_APP_ID, LOGI_GITHUB_INSTALLATION_ID and LOGI_GITHUB_PRIVATE_KEY together"
        )
    return { repository, appId, installationId, privateKey }
}
type Config = NonNullable<ReturnType<typeof githubConfig>>
export function githubAppJwt(config: Config, now: number) {
    const encode = (value: unknown) =>
        Buffer.from(JSON.stringify(value)).toString("base64url")
    const issuedAt = Math.floor(now / 1000)
    const input = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: config.appId, iat: issuedAt - 60, exp: issuedAt + 540 })}`
    let key: ReturnType<typeof createPrivateKey>
    try {
        key = createPrivateKey(config.privateKey)
        if (key.asymmetricKeyType !== "rsa") throw new Error()
    } catch {
        throw new Error(
            "LOGI_GITHUB_PRIVATE_KEY must be a valid RSA PEM private key"
        )
    }
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`
}

/** Cache only in memory; each fresh action isolate can independently obtain a token. */
export function createInstallationTokenProvider(
    request: typeof fetch = fetch,
    clock = Date.now
) {
    let cached: { config: Config; token: string; expiresAt: number } | undefined
    return async (config: Config) => {
        if (
            cached &&
            Object.entries(config).every(
                ([key, value]) => cached?.config[key as keyof Config] === value
            ) &&
            cached.expiresAt > clock() + 60000
        )
            return cached.token
        const response = await request(
            `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${githubAppJwt(config, clock())}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    repositories: [config.repository.split("/")[1]],
                    permissions: { issues: "write" },
                }),
                signal: AbortSignal.timeout(20000),
            }
        )
        if (!response.ok)
            throw new Error(
                `GitHub App token request failed (${response.status})`
            )
        const result = z
            .object({ token: z.string().min(1), expires_at: z.iso.datetime() })
            .parse(await response.json())
        const expiresAt = Date.parse(result.expires_at)
        if (expiresAt <= clock() + 60000)
            throw new Error("GitHub App returned an expired installation token")
        cached = { config: { ...config }, token: result.token, expiresAt }
        return result.token
    }
}
export const installationToken = createInstallationTokenProvider()
