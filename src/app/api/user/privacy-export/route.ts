import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"
import { NextResponse } from "next/server"
import JSZip from "jszip"

import { getCurrentPlayer, handleIfNotLoggedIn } from "@/lib/auth"
import { getInternalAuthSecret } from "@/lib/env"

const exportForUser = makeFunctionReference<"query">("privacy:exportForUser")

function escapeHtml(value: unknown) {
    return String(value ?? "—")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function section(title: string, content: string) {
    return `<section><h2>${escapeHtml(title)}</h2>${content}</section>`
}

function keyValue(data: Record<string, unknown>) {
    return `<dl>${Object.entries(data)
        .filter(([key]) => !key.startsWith("_"))
        .map(
            ([key, value]) =>
                `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : value)}</dd></div>`
        )
        .join("")}</dl>`
}

function table(rows: Array<Record<string, unknown>>) {
    if (!rows.length) return "<p class=empty>No records found.</p>"
    const columns = [
        ...new Set(rows.flatMap((row) => Object.keys(row))),
    ].filter((key) => !key.startsWith("_"))
    return `<div class=table-wrap><table><thead><tr>${columns.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((key) => `<td>${escapeHtml(Array.isArray(row[key]) || typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
}

function renderReport(data: {
    generatedAt: string
    user: Record<string, unknown>
    assignments: Array<Record<string, unknown>>
    playerStats: Array<Record<string, unknown>>
    performanceHistory: Array<Record<string, unknown>>
    platformLinkTokens: Array<Record<string, unknown>>
    privacyRequests: Array<Record<string, unknown>>
    eventParticipation: Array<Record<string, unknown>>
    rosterPlacements: Array<Record<string, unknown>>
}) {
    return `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Logi personal data export</title><style>body{margin:0;background:#f6f5f1;color:#18181b;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:1040px;margin:auto;padding:48px 24px}header{padding:32px;border-radius:24px;background:#18181b;color:white}h1{margin:0;font-size:32px}h2{font-size:20px;margin:0 0 16px}p{color:#52525b}header p{color:#d4d4d8}section{margin-top:24px;padding:28px;border:1px solid #e4e4e7;border-radius:20px;background:white}dl{display:grid;grid-template-columns:180px 1fr;margin:0}dl div{display:contents}dt,dd{margin:0;padding:10px;border-bottom:1px solid #f1f1f2}dt{font-weight:700;color:#52525b}dd{overflow-wrap:anywhere}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;vertical-align:top;border-bottom:1px solid #eee;white-space:pre-wrap}th{color:#52525b;background:#fafafa}.empty{margin:0;color:#71717a}.note{font-size:13px}</style></head><body><main class=wrap><header><h1>Your Logi personal data</h1><p>Generated ${escapeHtml(data.generatedAt)}. This report is designed for people to read; the accompanying JSON file is the machine-readable copy.</p></header>${section("Account profile", keyValue(data.user))}${section("Clan assignments", table(data.assignments))}${section("Event participation", table(data.eventParticipation))}${section("Roster placements", table(data.rosterPlacements))}${section("Player statistics", table(data.playerStats))}${section("Performance history", table(data.performanceHistory))}${section("Platform link records", table(data.platformLinkTokens))}${section("Privacy requests", table(data.privacyRequests))}<p class=note>This report intentionally excludes other players’ personal data.</p></main></body></html>`
}

export async function POST() {
    await handleIfNotLoggedIn("/dashboard/settings/user")
    const user = await getCurrentPlayer()
    if (!user)
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    const data = await fetchQuery(exportForUser, {
        secret: getInternalAuthSecret(),
        userId: user.id,
    })
    const zip = new JSZip()
    zip.file("index.html", renderReport(data))
    zip.file("logi-personal-data.json", JSON.stringify(data, null, 2))
    zip.file(
        "README.txt",
        "Open index.html for the human-readable report. logi-personal-data.json is included as the machine-readable copy. This archive intentionally excludes other players' personal data."
    )
    const archive = await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
    })
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(archive)
            controller.close()
        },
    })
    return new NextResponse(stream, {
        headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename=logi-personal-data-${new Date().toISOString().slice(0, 10)}.zip`,
        },
    })
}
