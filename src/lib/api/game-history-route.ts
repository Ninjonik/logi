import {
    historyFiltersSchema,
    historyPageSchema,
    historyRecordSchema,
    type HistoryFilters,
} from "@/domain/game-data/history"
import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

const positionSchema = z.strictObject({
    position: z.string().min(1).max(4096),
    revision: z.string().regex(/^(0|[1-9][0-9]{0,127})$/),
    issuedAt: z.number().int().safe(),
})
type ReadInput = {
    filters: HistoryFilters
    id?: string
    cursor: string | null
    revision?: string
}

export async function handleGameHistoryRead(
    request: Request,
    dependencies: {
        guildId: string
        binding: string
        secret: string
        headers?: Record<string, string>
        read: (input: ReadInput) => Promise<unknown>
    }
) {
    const headers = { ...dependencies.headers, "Cache-Control": "no-store" }
    const error = (code: string, status: number) =>
        Response.json({ error: { code } }, { status, headers })
    const params = new URL(request.url).searchParams
    const known = ["game", "sourceId", "map", "from", "until", "id", "cursor"]
    if (
        request.method !== "GET" ||
        params.get("game") !== "wardogs" ||
        [...params.keys()].some(
            (key) => !known.includes(key) || params.getAll(key).length !== 1
        )
    )
        return error("invalid_query", 400)
    const filtersInput = Object.fromEntries(
        [...params].filter(([key]) =>
            ["sourceId", "map", "from", "until"].includes(key)
        )
    )
    const filters = historyFiltersSchema.safeParse(filtersInput),
        id = params.get("id"),
        cursor = params.get("cursor")
    if (
        !filters.success ||
        (id !== null &&
            (!id ||
                id.length > 200 ||
                Object.keys(filtersInput).length > 0 ||
                cursor !== null)) ||
        (cursor !== null && (!cursor || cursor.length > 8192))
    )
        return error("invalid_query", 400)
    if (!dependencies.secret) return error("unavailable", 503)
    const binding = JSON.stringify([
        dependencies.guildId,
        dependencies.binding,
        filters.data,
    ])
    const sign = (body: string) =>
        createHmac("sha256", dependencies.secret)
            .update(`logi-history-page-v1:${binding}:${body}`)
            .digest()
    const input: ReadInput = {
        filters: filters.data,
        cursor: null,
        ...(id !== null ? { id } : {}),
    }
    if (cursor) {
        try {
            const parts = cursor.split(".")
            if (parts.length !== 2) throw new Error()
            const received = Buffer.from(parts[1], "base64url"),
                expected = sign(parts[0])
            if (
                received.length !== expected.length ||
                !timingSafeEqual(received, expected)
            )
                throw new Error()
            const position = positionSchema.parse(
                JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))
            )
            if (
                position.issuedAt > Date.now() ||
                Date.now() - position.issuedAt >= 86_400_000
            )
                throw new Error()
            input.cursor = position.position
            input.revision = position.revision
        } catch {
            return error("invalid_cursor", 400)
        }
    }
    try {
        const value = await dependencies.read(input)
        if (value === null)
            return error(
                id !== null ? "not_found" : "insufficient_scope",
                id !== null ? 404 : 403
            )
        if (
            typeof value === "object" &&
            value !== null &&
            "resetRequired" in value
        )
            return error("reset_required", 410)
        if (id !== null) {
            const record = historyRecordSchema.parse(value)
            if (record.id !== id || record.guildId !== dependencies.guildId)
                throw new Error()
            return Response.json({ data: record }, { headers })
        }
        const page = historyPageSchema.parse(value)
        if (
            page.items.some(
                (record) =>
                    record.guildId !== dependencies.guildId ||
                    BigInt(record.revision) > BigInt(page.revision)
            ) ||
            (input.revision && page.revision !== input.revision)
        )
            throw new Error()
        if (page.nextCursor !== null) {
            const body = Buffer.from(
                JSON.stringify({
                    position: page.nextCursor,
                    revision: page.revision,
                    issuedAt: Date.now(),
                })
            ).toString("base64url")
            page.nextCursor = `${body}.${sign(body).toString("base64url")}`
        }
        return Response.json({ data: page }, { headers })
    } catch {
        return error("unavailable", 503)
    }
}
