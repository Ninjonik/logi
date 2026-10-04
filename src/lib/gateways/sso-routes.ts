import { ssoRoutes, type SsoRoutePorts } from "../api/sso-routes"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { createSsoSecret, hashSsoValue } from "../sso"
import { makeFunctionReference } from "convex/server"
import { getSsoProvider } from "./sso-provider"
import { getInternalAuthSecret } from "../env"
import { getSession } from "../auth"
const query = (name: string, args: Record<string, unknown>) =>
    fetchQuery(makeFunctionReference<"query">(`sso:${name}`), {
        secret: getInternalAuthSecret(),
        ...args,
    })
const mutation = (name: string, args: Record<string, unknown>) =>
    fetchMutation(makeFunctionReference<"mutation">(`sso:${name}`), {
        secret: getInternalAuthSecret(),
        ...args,
    })
const ports: SsoRoutePorts = {
    provider: getSsoProvider,
    session: getSession,
    client: (clientId) => query("getPublicClient", { clientId }),
    createCode: async (input) => {
        await mutation("createCode", input)
    },
    redeem: (input) => mutation("redeemCode", input),
    profile: (tokenHash) => query("getProfile", { tokenHash }),
    random: createSsoSecret,
    hash: hashSsoValue,
}
export const ssoHttp = ssoRoutes(ports)
