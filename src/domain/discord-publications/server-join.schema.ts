import {
    isServerAddress,
    SERVER_JOIN_SLUG_PATTERN,
    SERVER_PASSWORD_MAX_LENGTH,
} from "./server-join"
import { z } from "zod"

/**
 * Zod schemas of the join settings and the server password. The pure rules
 * (`serverJoinUrl`, `passwordShown`, `joinPagePlayers`, …) stay in
 * `server-join.ts`, which the bot's panel reads walk without Zod.
 */

/** "203.0.113.24:7777", "[2001:db8::1]:7777" or "hll.example.net:7777". */
export const serverAddressSchema = z
    .string()
    .trim()
    .max(100)
    .refine(isServerAddress, "Use host:port, e.g. 203.0.113.24:7777.")

/** The Wardogs join code (P4-35, P2-39). */
export const joinCodeSchema = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,24}$/, "Use letters, digits and dashes.")

export const serverJoinSlugSchema = z.string().regex(SERVER_JOIN_SLUG_PATTERN)

/** "Heslo serveru": what HLL accepts; no control characters. */
export const serverPasswordSchema = z
    .string()
    .min(1)
    .max(SERVER_PASSWORD_MAX_LENGTH)
    .refine(
        (value) => !/[\u0000-\u001f\u007f]/.test(value),
        "No control characters."
    )

/** The sealed text; a JSON wrapper keeps even a one-letter password above the cipher's minimum. */
export function serverPasswordPlaintext(password: string) {
    return JSON.stringify({
        v: 1,
        password: serverPasswordSchema.parse(password),
    })
}
export function serverPasswordFromPlaintext(plaintext: string): string {
    const parsed = z
        .strictObject({ v: z.literal(1), password: serverPasswordSchema })
        .safeParse(JSON.parse(plaintext))
    if (!parsed.success) throw new Error("Invalid server password.")
    return parsed.data.password
}
