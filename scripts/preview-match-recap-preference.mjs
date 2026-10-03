// Static, loopback-only simulated Discord render of the production message builder.
import { buildMatchRecapPreferenceUpdate } from "../discord-bot/src/interactions/match-recap-preference.ts"
import { createServer } from "node:http"

const escape = (value) =>
    value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[character]
    )
const examples = ["cs", "en", "de"].map((locale) => {
    const states = [false, true].map((enabled) => {
        const payload = buildMatchRecapPreferenceUpdate(enabled, locale)
        const button = payload.components[0].toJSON().components[0]
        return `<article><h3>${enabled ? "After subscribing" : "After unsubscribing"}</h3>
            <p>${escape(payload.content)}</p><div class="button">${escape(button.label)}</div>
            <p class="meta">Next action: <code>${escape(button.custom_id)}</code></p></article>`
    })
    return `<section><h2>${locale.toUpperCase()}</h2><div class="states">${states.join("")}</div></section>`
})
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi · match recap preferences</title>
<style>body{background:#202127;color:#ececf1;font:16px/1.5 system-ui;margin:0;padding:24px}main{max-width:1050px;margin:auto}h1{font-size:24px}h2{font-size:18px;color:#f2c66d}h3{font-size:13px;color:#b4b7c5;margin:0 0 12px}.states{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{padding:20px;background:#292b32;border:1px solid #434652;border-radius:8px}.button{display:inline-block;background:#454752;padding:7px 14px;border-radius:4px;font-size:14px}.meta,header p{color:#b4b7c5;font-size:14px}code{overflow-wrap:anywhere}section{margin:20px 0}@media(max-width:600px){.states{grid-template-columns:1fr}}</style>
</head><body><main><header><h1>Logi — match recap notification preferences</h1>
<p>Static simulated Discord render. Exact production builder output; synthetic scenario, no live message.</p>
<p>Unsubscribe stores false. Subscribe stores true. The button offers the opposite action after success.</p>
</header>${examples.join("")}</main></body></html>`
const server = createServer((request, response) => {
    if (request.url === "/__fixture/stop" && request.method === "POST") {
        response.end("Stopped")
        server.close()
        return
    }
    if (request.url !== "/" || request.method !== "GET") {
        response.writeHead(404)
        response.end()
        return
    }
    response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
    })
    response.end(html)
})
server.listen(4326, "127.0.0.1", () =>
    console.log(
        "Synthetic match recap preference preview: http://127.0.0.1:4326/"
    )
)
