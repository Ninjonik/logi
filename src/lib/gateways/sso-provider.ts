import { configureSsoSigning } from "../../infrastructure/identity/sso-signing"
import { getSsoProviderEnvironment } from "../env"
let cached:
    | {
          value: string
          issuer: string
          loopback: boolean
          signing: ReturnType<typeof configureSsoSigning>
      }
    | undefined
export async function getSsoProvider() {
    const env = getSsoProviderEnvironment()
    if (
        !cached ||
        cached.value !== env.privateJwk ||
        cached.issuer !== env.issuer ||
        cached.loopback !== env.allowLoopbackHttp
    ) {
        const signing = configureSsoSigning(env).catch(() => {
            throw new Error("SSO provider unavailable.")
        })
        cached = {
            value: env.privateJwk,
            issuer: env.issuer,
            loopback: env.allowLoopbackHttp,
            signing,
        }
    }
    return cached.signing
}
