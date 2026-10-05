"use node"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import {
    CredentialCipherError,
    openSecret,
    parseKeyring,
} from "../src/infrastructure/game-data/credential-cipher"
import {
    serverPasswordAad,
    serverPasswordFromPlaintext,
} from "../src/domain/discord-publications/server-join"
import type { CredentialEnvelope } from "../src/domain/game-data/credentials"
import { action } from "./_generated/server"

/**
 * The server password of a private panel, decrypted for the bot only
 * (P4-29..31, P4-B06). The bot asks for it only after it confirmed that
 * `@everyone` cannot view the channel. Decryption uses this deployment's
 * keyring (`LOGI_CREDENTIAL_KEYRING`); a missing key or a failed decryption
 * returns no password, never a fallback. The value is never logged.
 */
export type ServerPasswordResult =
    | { password: string }
    | {
          password: null
          reason: "not_set" | "key_unavailable" | "decrypt_failed"
      }

export const serverPassword = action({
    args: { secret: v.string(), guildId: v.string(), panelId: v.string() },
    handler: async (ctx, args): Promise<ServerPasswordResult> => {
        if (
            !process.env.INTERNAL_AUTH_SECRET ||
            args.secret !== process.env.INTERNAL_AUTH_SECRET
        )
            throw new Error("Unauthorized.")
        const stored = await ctx.runQuery(
            makeFunctionReference<
                "query",
                { guildId: string; panelId: string },
                { connectionId: string; envelope: CredentialEnvelope } | null
            >("discordPanelBot:passwordEnvelope"),
            { guildId: args.guildId, panelId: args.panelId }
        )
        if (!stored) return { password: null, reason: "not_set" }
        try {
            const keyring = parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING)
            return {
                password: serverPasswordFromPlaintext(
                    openSecret(
                        keyring,
                        stored.envelope,
                        serverPasswordAad({
                            guildId: args.guildId,
                            connectionId: stored.connectionId,
                        })
                    )
                ),
            }
        } catch (error) {
            return {
                password: null,
                reason:
                    error instanceof CredentialCipherError &&
                    error.category === "decrypt_failed"
                        ? "decrypt_failed"
                        : "key_unavailable",
            }
        }
    },
})
