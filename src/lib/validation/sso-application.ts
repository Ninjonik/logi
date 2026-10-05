import { z } from "zod"

const url = z.string().trim().min(1).max(2048)

/**
 * A change to a single sign-on application from the dashboard: its name,
 * website and the addresses users return to after signing in. The client ID
 * and secret are never part of it. HTTPS and loopback rules are checked again
 * where the provider's settings are known.
 */
export const ssoApplicationUpdateSchema = z.strictObject({
    name: z.string().trim().min(1).max(100),
    websiteUrl: url,
    redirectUris: z.array(url).min(1).max(10),
})
export type SsoApplicationUpdate = z.infer<typeof ssoApplicationUpdateSchema>

/** Client IDs Logi issues; anything else cannot name an application. */
export const ssoClientIdSchema = z.string().regex(/^logi_[A-Za-z0-9_-]{24}$/)
