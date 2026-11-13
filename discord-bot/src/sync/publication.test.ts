import { ChannelType, type Client } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { closeConvexClient } from "../convex"
import test, { afterEach } from "node:test"
import assert from "node:assert/strict"
afterEach(closeConvexClient)

import {
    PublicationChannelError,
    PublicationPermissionError,
    publicationDeliveryError,
    publicationSource,
    publishManagedMessage,
} from "./publication"
import { PublicationNotSent } from "../../../src/application/discord-publications/publish"

test("a failed delivery uses the errors channel's words, never the English internal text (L5-44)", () => {
    const failure = new PublicationPermissionError(
        ["SendMessages", "EmbedLinks"],
        "servery"
    )
    assert.equal(
        publicationDeliveryError("cs", failure, "panel:abc"),
        "Panel se neaktualizoval. Proč: Bot nemá v kanálu #servery oprávnění Posílat zprávy a Vkládat odkazy. Co udělat: V Discordu otevři #servery → Upravit kanál → Oprávnění → Logi a povol Posílat zprávy a Vkládat odkazy."
    )
    assert.match(
        publicationDeliveryError("cs", failure, "event:e1:announcement"),
        /^Ohlášení zápasu se neodeslalo\. Proč:/
    )
    assert.match(
        publicationDeliveryError(
            "cs",
            Object.assign(new PublicationNotSent("x"), {
                deliveryCause: { code: 10003 },
            }),
            "calendar"
        ),
        /^Kalendář se neaktualizoval\. Proč: Kanál z nastavení Logi už na serveru není\. Co udělat: Vyber nový kanál v Logi → Kanály a jazyk\.$/
    )
    assert.match(
        publicationDeliveryError("de", new PublicationNotSent("x")),
        /^Das Panel wurde nicht aktualisiert\. Warum: Discord hat die Aktion abgelehnt\./
    )
    for (const language of ["cs", "de"]) {
        const text = publicationDeliveryError(language, failure)
        assert.doesNotMatch(
            text,
            /Discord delivery failed|permissions missing|PublicationNotSent/
        )
        assert.ok(text.length <= 240)
    }
})

test("the real publication adapter recovers a deleted previous channel and preserves unreadable bindings", async (t) => {
    for (const code of [10003, 50013, 0]) {
        let creates = 0
        const states: Array<Record<string, unknown>> = []
        t.mock.method(ConvexReactClient.prototype, "query", async () => ({
            defaultLanguage: "en",
        }))
        t.mock.method(
            ConvexReactClient.prototype,
            "mutation",
            async (
                reference: Parameters<typeof getFunctionName>[0],
                args: Record<string, unknown>
            ) => {
                if (getFunctionName(reference) === "discordPublications:claim")
                    return {
                        id: "publication",
                        fence: 1,
                        channelId: "old",
                        messageId: "old-message",
                        pending: null,
                        hash: null,
                    }
                states.push(args)
                return null
            }
        )
        const guild = {
            channels: {
                fetch: async (id: string) => {
                    if (id === "old")
                        throw Object.assign(Error("unavailable"), {
                            code,
                            status: code === 50013 ? 403 : 503,
                        })
                    return {
                        type: ChannelType.GuildText,
                        isTextBased: () => true,
                        permissionsFor: () => ({ has: () => true }),
                        send: async () => {
                            creates++
                            return { id: "new-message" }
                        },
                    }
                },
            },
            members: { fetchMe: async () => ({}) },
        }
        const client = {
            user: { id: "bot" },
            guilds: { fetch: async () => guild },
        } as unknown as Client
        const operation = publishManagedMessage(client, {
            guildId: "guild",
            key: "calendar",
            revision: 1,
            channelId: "new",
            message: { content: "updated" },
        })
        if (code === 10003) {
            assert.equal(await operation, "new-message")
            assert.equal(creates, 1)
            assert.ok(states.some((state) => state.messageId === null))
        } else {
            await assert.rejects(operation)
            assert.equal(creates, 0)
            assert.equal(
                states.some((state) => state.messageId === null),
                false
            )
        }
    }
})

test("a create Discord refused and a deleted channel use the same sentences as the errors channel (L5-44)", () => {
    // Only `cause`, as the create path wraps Discord's 403.
    assert.equal(
        publicationDeliveryError(
            "cs",
            Object.assign(
                new PublicationNotSent("Discord rejected the create request."),
                {
                    cause: Object.assign(new Error("Missing Access"), {
                        code: 50001,
                        status: 403,
                    }),
                }
            ),
            "calendar"
        ),
        "Kalendář se neaktualizoval. Proč: Bot do kanálu z nastavení Logi nevidí. Co udělat: Přidej roli Logi do kanálu, nebo vyber jiný kanál v Logi."
    )
    assert.equal(
        publicationDeliveryError(
            "cs",
            Object.assign(new PublicationNotSent("x"), {
                cause: new PublicationChannelError("channel_missing"),
                deliveryCause: new PublicationChannelError("channel_missing"),
            }),
            "ticket"
        ),
        "Panel ticketů se neaktualizoval. Proč: Kanál z nastavení Logi už na serveru není. Co udělat: Vyber nový kanál v Logi → Kanály a jazyk."
    )
    assert.doesNotMatch(
        publicationDeliveryError(
            "cs",
            new PublicationPermissionError(["EmbedLinks"], "info", "1"),
            "event:e1:info"
        ),
        /Discord akci odmítl/
    )
})

test("managed messages are named by their key", () => {
    assert.equal(publicationSource("event:e1:info"), "roster")
    assert.equal(publicationSource("event:e1:announcement"), "announcement")
    assert.equal(publicationSource("event:e1:roster"), "roster")
    assert.equal(publicationSource("event:e1:roster-changes"), "roster")
    assert.equal(publicationSource("ticket"), "ticketPanel")
    assert.equal(publicationSource("membership"), "applicationPanel")
    assert.equal(publicationSource("calendar"), "calendarPanel")
    assert.equal(publicationSource("league:1"), "publicPanel")
    assert.equal(publicationSource(undefined), "publicPanel")
})

test("an uncertain create says so in the clan language", () => {
    const uncertain = new Error(
        "Delivery uncertain: exact message marker not found in recent history. Operator reconciliation required."
    )
    assert.match(
        publicationDeliveryError("cs", uncertain),
        /^Není jisté, jestli zpráva do Discordu dorazila/
    )
    assert.match(
        publicationDeliveryError(undefined, uncertain),
        /^It is unclear whether the message reached Discord/
    )
})
