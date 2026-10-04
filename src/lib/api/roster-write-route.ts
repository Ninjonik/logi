import type { RosterDashboardActor } from "../../../convex/rosterWriterAccess"
import { rosterMutationSchema } from "../../domain/api/roster-mutation"
import { z } from "zod"

const inputSchema = rosterMutationSchema
    .extend({
        rosterId: z.string().min(1).max(200).optional(),
        eventId: z.string().min(1).max(200),
    })
    .strict()
export type RosterWriteInput = z.infer<typeof inputSchema>
const json = (body: unknown, status: number) =>
    Response.json(body, {
        status,
        headers: {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    })

async function readInput(request: Request) {
    const limit = 256 * 1024
    const length = request.headers.get("content-length")
    if (
        request.headers
            .get("content-type")
            ?.split(";")[0]
            .trim()
            .toLowerCase() !== "application/json" ||
        !request.body ||
        (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    )
        throw new Error("Invalid body.")
    const reader = request.body.getReader()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            (async () => {
                const chunks: Uint8Array[] = []
                let size = 0
                while (true) {
                    const chunk = await reader.read()
                    if (chunk.done) break
                    size += chunk.value.byteLength
                    if (size > limit) throw new Error("Invalid body.")
                    chunks.push(chunk.value)
                }
                const bytes = new Uint8Array(size)
                let offset = 0
                for (const chunk of chunks) {
                    bytes.set(chunk, offset)
                    offset += chunk.byteLength
                }
                return inputSchema.parse(
                    JSON.parse(
                        new TextDecoder("utf-8", { fatal: true }).decode(bytes)
                    )
                )
            })(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error("Invalid body.")),
                    5_000
                )
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
        void reader.cancel().catch(() => undefined)
    }
}

/** Browser input never chooses the actor, operator override or internal credential. */
export function rosterWriteHandler(ports: {
    origin: string
    actor(): Promise<RosterDashboardActor | null>
    write(
        serverId: string,
        actor: RosterDashboardActor,
        input: RosterWriteInput
    ): Promise<string>
}) {
    return async (request: Request, serverId: string) => {
        if (request.method !== "POST")
            return json({ error: "Method not allowed." }, 405)
        if (request.headers.get("origin") !== ports.origin)
            return json({ error: "Forbidden." }, 403)
        if (!serverId || serverId.length > 200)
            return json({ error: "Invalid workspace." }, 400)
        try {
            const actor = await ports.actor()
            if (!actor) return json({ error: "Authentication required." }, 401)
            let input: RosterWriteInput
            try {
                input = await readInput(request)
            } catch {
                return json({ error: "Invalid roster." }, 400)
            }
            const id = await ports.write(serverId, actor, input)
            if (!id || typeof id !== "string")
                throw new Error("Invalid response.")
            return json({ id }, 200)
        } catch (error) {
            return error instanceof Error &&
                /Forbidden\.|Unauthorized\./.test(error.message)
                ? json({ error: "Forbidden." }, 403)
                : json({ error: "Unable to save roster." }, 503)
        }
    }
}
