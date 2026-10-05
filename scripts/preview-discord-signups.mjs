// Loopback-only simulated Discord presentation from the actual message builders.
// Run with the synthetic bot environment described in the verification handoff.
import {
    buildCompactV2FieldText,
    buildEventEmbed,
} from "../discord-bot/src/message-builders.ts"
import { createServer } from "node:http"

const names = ["Golf", "Delta", "Alpha", "Foxtrot", "Charlie", "Echo", "Bravo"]
const timestamp = "2026-09-29T12:00:00.000Z"
const groups = [
    {
        id: "command",
        guildId: "fixture",
        name: "Command",
        color: "#d4a017",
        updatedAt: timestamp,
    },
]
const event = {
    id: "fixture-event",
    guildId: "fixture",
    kind: "match",
    name: "Synthetic signup proof",
    requiredRoleIds: [],
    rewardRoleIds: [],
    registrationEnd: timestamp,
    meetingStart: timestamp,
    gameStart: timestamp,
    gameEnd: timestamp,
    pingClan: false,
    createForumChannel: false,
    status: "registration",
    statusUpdatedAt: timestamp,
    attendanceReminderLog: [],
    signUps: [],
    updatedAt: timestamp,
    participants: names.map((name, index) => ({
        userId: `fixture-${index}`,
        status: "attending",
        group: "command",
        updatedAt: timestamp,
    })),
}
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
const examples = ["en", "cs", "de"].map((defaultLanguage) => {
    const config = {
        id: "fixture",
        guildId: "fixture",
        timezone: "Europe/Prague",
        defaultLanguage,
        calendarCategories: [],
        updatedAt: timestamp,
    }
    const fields = buildEventEmbed(
        config,
        groups,
        [],
        event,
        undefined,
        Object.fromEntries(
            names.map((name, index) => [`fixture-${index}`, name])
        )
    )
        .toJSON()
        .fields.slice(0, 3)
    return `<section><h2>${defaultLanguage.toUpperCase()} · configured server language</h2>
        <h3>Legacy embed · signups</h3><div class="embed">${fields
            .map(
                (field) =>
                    `<div><strong>${escape(field.name)}</strong><p>${escape(field.value)}</p></div>`
            )
            .join("")}</div><h3>Components V2 · compact signups</h3>
        <pre>${escape(buildCompactV2FieldText(fields)).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</pre></section>`
})
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Logi · signup ordering proof</title>
<style>body{background:#202127;color:#ececf1;font:16px/1.5 system-ui;margin:0;padding:24px}main{max-width:950px;margin:auto}h1{font-size:24px}h2{font-size:18px;color:#f2c66d}h3{font-size:13px;color:#b4b7c5;margin:12px 0 6px}p{white-space:pre-line;margin:4px 0}section{padding:12px 20px;background:#292b32;border:1px solid #434652;border-radius:8px;margin:18px 0}.embed{display:grid;grid-template-columns:repeat(3,1fr);border-left:4px solid #e8a33d;padding:10px 16px;background:#23252b;gap:12px}pre{font:inherit;white-space:pre-wrap;background:#23252b;padding:12px;border-radius:6px}header p{color:#b4b7c5}</style>
</head><body><main><header><h1>Logi — Discord signup ordering</h1>
<p>Simulated render of actual builder output with synthetic names. No Discord message or provider call.</p>
<p>Each legacy row reads left to right. The compact list preserves that order. Czech Ch sorts after H.</p>
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
server.listen(4325, "127.0.0.1", () =>
    console.log("Synthetic Discord signup preview: http://127.0.0.1:4325/")
)
