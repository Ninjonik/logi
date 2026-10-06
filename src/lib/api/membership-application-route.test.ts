import assert from "node:assert/strict"
import test from "node:test"

import { membershipApplicationRoutes } from "./membership-application-route"
import { webApplicationRoutes } from "./web-application-route"

const post = (body: unknown) =>
    new Request("https://logi.example/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    })

function adminRoutes(input: { origin?: boolean; admin?: boolean } = {}) {
    const calls: unknown[] = []
    return {
        calls,
        routes: membershipApplicationRoutes({
            isWriteOrigin: () => input.origin ?? true,
            access: async () =>
                (input.admin ?? true) ? { guildId: "1" } : null,
            checkChannels: async (_access, channels) => {
                calls.push(channels)
                return { panel: { ok: true }, threads: { ok: false } }
            },
            attachImage: async (_access, assetId) => {
                calls.push(assetId)
                return assetId === "bad"
                    ? { ok: false }
                    : { ok: true, url: "https://cdn.example/banner.webp" }
            },
        }),
    }
}

test("channel checks need a clan admin from the dashboard origin", async () => {
    for (const input of [{ origin: false }, { admin: false }]) {
        const { routes, calls } = adminRoutes(input)
        const response = await routes.POST(
            post({
                action: "check-channels",
                panelChannelId: null,
                threadChannelId: null,
            }),
            { serverId: "x" }
        )
        assert.equal(response.status, 403)
        assert.deepEqual(calls, [])
    }
})

test("the channel report comes back for the settings page (N4-B08)", async () => {
    const { routes, calls } = adminRoutes()
    const response = await routes.POST(
        post({
            action: "check-channels",
            panelChannelId: "123456789012345678",
            threadChannelId: "223456789012345678",
        }),
        { serverId: "x" }
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
        channels: { panel: { ok: true }, threads: { ok: false } },
    })
    assert.deepEqual(calls, [
        {
            panelChannelId: "123456789012345678",
            threadChannelId: "223456789012345678",
        },
    ])
})

test("malformed requests and foreign images are refused", async () => {
    const { routes } = adminRoutes()
    assert.equal(
        (
            await routes.POST(
                post({ action: "check-channels", panelChannelId: "x" }),
                {
                    serverId: "x",
                }
            )
        ).status,
        400
    )
    assert.equal(
        (
            await routes.POST(
                post({ action: "attach-image", assetId: "bad" }),
                {
                    serverId: "x",
                }
            )
        ).status,
        400
    )
    const ok = await routes.POST(
        post({ action: "attach-image", assetId: null }),
        {
            serverId: "x",
        }
    )
    assert.deepEqual(await ok.json(), {
        url: "https://cdn.example/banner.webp",
    })
})

function applicantRoutes(input: { origin?: boolean; signedIn?: boolean } = {}) {
    const calls: unknown[] = []
    return {
        calls,
        routes: webApplicationRoutes({
            isWriteOrigin: () => input.origin ?? true,
            applicant: async () =>
                (input.signedIn ?? true) ? { subject: "111" } : null,
            status: async () => ({ state: "editing" }),
            save: async (_applicant, guildId, windowId, values) => {
                calls.push({ guildId, windowId, values })
                return { ok: true }
            },
            submit: async (_applicant, guildId) => {
                calls.push({ submit: guildId })
                return { ok: true }
            },
        }),
    }
}

test("the web form needs a signed-in applicant and the dashboard origin", async () => {
    const guild = { guildId: "123456789012345678" }
    const anonymous = applicantRoutes({ signedIn: false })
    assert.equal(
        (await anonymous.routes.GET(new Request("https://x"), guild)).status,
        401
    )
    const foreign = applicantRoutes({ origin: false })
    assert.equal(
        (await foreign.routes.POST(post({ action: "submit" }), guild)).status,
        403
    )
    assert.deepEqual(foreign.calls, [])
})

test("a step is saved and the application submitted for the session's applicant", async () => {
    const guild = { guildId: "123456789012345678" }
    const { routes, calls } = applicantRoutes()
    const saved = await routes.POST(
        post({
            action: "save",
            windowId: "about",
            values: { name: ["Hráč 17"], category: ["main"] },
        }),
        guild
    )
    assert.equal(saved.status, 200)
    await routes.POST(post({ action: "submit" }), guild)
    assert.deepEqual(calls, [
        {
            guildId: "123456789012345678",
            windowId: "about",
            values: { name: ["Hráč 17"], category: ["main"] },
        },
        { submit: "123456789012345678" },
    ])
    // A browser cannot name another user.
    assert.equal(
        (await routes.POST(post({ action: "submit", userId: "999" }), guild))
            .status,
        400
    )
})
