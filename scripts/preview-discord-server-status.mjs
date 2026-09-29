// Loopback-only simulated Discord layout with production builder/projection output.
import {
    projectSnapshot,
    projectHealth,
} from "../src/domain/game-data/policy.ts"
import { buildServerStatusReply } from "../discord-bot/src/interactions/server-status.ts"
import { getClanDiscordMessages } from "../src/lib/clan-language.ts"
import { createServer } from "node:http"

const now = Date.parse("2026-09-29T12:00:00Z")
const guildId = "111111111111111111"
function connection(id, gameId, provider, overrides = {}) {
    const row = {
        id,
        guildId,
        gameId,
        provider,
        enabled: true,
        generation: 1,
        fence: 1,
        leaseUntil: 0,
        lastAttemptAt: new Date(now - 10_000).toISOString(),
        errorCategory: null,
        observation: {
            observedAt: new Date(now - 10_000).toISOString(),
            providerUpdatedAt: null,
            displayName: id,
            state: "online",
            map: null,
            players: 0,
            capacity: 100,
            providerInstanceId: null,
            scores: [],
            capabilities: ["server_snapshot"],
        },
        ...overrides,
    }
    return {
        sourceRef: "synthetic",
        configured: true,
        snapshot: projectSnapshot(row, now),
        health: projectHealth(row, now),
    }
}
const wdg = connection(
    "Synthetic WDG server",
    "wardogs",
    "wardogs_public_directory"
)
const hll = connection("Synthetic HLL server", "hell_let_loose", "hll_crcon", {
    observation: {
        observedAt: new Date(now - 300_000).toISOString(),
        providerUpdatedAt: null,
        displayName: "Synthetic HLL server",
        state: "online",
        map: "Foy",
        players: 42,
        capacity: 100,
        providerInstanceId: null,
        scores: [],
        capabilities: ["server_snapshot"],
    },
})
const disabled = connection(
    "Synthetic paused HLL source",
    "hell_let_loose",
    "hll_crcon",
    { enabled: false }
)
const escape = (value) =>
    String(value).replace(
        /[&<>"']/g,
        (char) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[char]
    )
function markdown(value, locale) {
    return escape(value)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(
            /\[Wardog Servers\]\(https:\/\/wardogservers\.com\)/g,
            '<a href="https://wardogservers.com">Wardog Servers</a>'
        )
        .replace(
            /&lt;t:(\d+):R&gt;/g,
            (_, seconds) =>
                `<time>${escape(new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round((Number(seconds) * 1000 - now) / 1000), "second"))}</time>`
        )
        .replace(/\n/g, "<br>")
}
function render(locale) {
    const settings = { sources: [], connections: [wdg, hll, disabled] }
    const copy = getClanDiscordMessages(locale).serverStatus
    function card(label, game, data) {
        const embed = buildServerStatusReply(
            locale,
            guildId,
            game,
            data
        ).embeds[0].toJSON()
        return `<article><h2>${escape(label)}</h2><p class="command">/server-status game:${game}</p><div class="embed"><h3>${escape(embed.title)}</h3><p>${escape(embed.description)}</p>${(embed.fields ?? []).map((field) => `<div class="field"><h4>${escape(field.name)}</h4><p>${markdown(field.value, locale)}</p></div>`).join("")}<footer>${escape(embed.footer?.text ?? "")}</footer></div></article>`
    }
    return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi · server status command</title>
<style>body{background:#202127;color:#ececf1;font:14px/1.5 system-ui;margin:0;padding:24px}main{max-width:1150px;margin:auto}h1{font-size:25px;margin:0 0 8px}header p,footer{color:#b4b7c5}nav{display:flex;gap:16px}a{color:#91b1ff}section{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px}article{padding:18px;background:#292b32;border:1px solid #444650;border-radius:8px}h2{font-size:14px;color:#f2c66d;margin:0}h3{font-size:17px;margin:0}h4{margin:12px 0 5px}p{margin:8px 0}.command{font:12px/1.5 monospace;color:#b4b7c5}.embed{border-left:4px solid #5865f2;background:#23242b;padding:14px}.field p{margin:0}footer{font-size:12px;margin-top:14px}time{background:#383b47;padding:1px 4px;border-radius:3px}.error{padding:12px;background:#23242b;border-left:4px solid #c87b53;margin-top:15px}@media(max-width:720px){section{grid-template-columns:1fr}}</style>
</head><body><main><header><h1>Logi /server-status · ${locale.toUpperCase()}</h1><p>Static simulated Discord render · actual production builder and snapshot policy · synthetic data</p><p>Manager-only command · reply visible only to its requester · no live Discord or provider request</p><nav><a href="/?locale=cs">Čeština</a><a href="/?locale=en">English</a><a href="/?locale=de">Deutsch</a></nav></header><section>
${card("Fresh observation · zero players retained", "wardogs", settings)}
${card("Stale and disabled observations · not reported online", "hell_let_loose", settings)}
${card("No connection · no invented zero or offline state", "wardogs", { sources: [], connections: [] })}
<article><h2>Denied access / unavailable backend</h2><p class="command">Private localized responses</p><p class="error">${escape(copy.forbidden)}</p><p class="error">${escape(copy.unavailable)}</p><footer>Backend wait is limited to 10 seconds. Source addresses, credentials and internal IDs are omitted.</footer></article>
</section></main></body></html>`
}
const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4327")
    if (url.pathname === "/__fixture/stop" && request.method === "POST") {
        response.end("Stopped")
        server.close()
        return
    }
    if (url.pathname !== "/" || request.method !== "GET") {
        response.writeHead(404)
        response.end()
        return
    }
    const locale = ["cs", "en", "de"].includes(url.searchParams.get("locale"))
        ? url.searchParams.get("locale")
        : "cs"
    response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
    })
    response.end(render(locale))
})
server.listen(4327, "127.0.0.1", () =>
    console.log(
        "Synthetic server status preview: http://127.0.0.1:4327/?locale=cs"
    )
)
