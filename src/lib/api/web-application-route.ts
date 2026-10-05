import { z } from "zod"

import { readBoundedJson } from "@/lib/api/request-json"

/**
 * Routes of the web application form (Variant B, N4-42, L6-16, L6-17):
 * - `GET /api/applications/{guildId}`: where the application is (editing,
 *   waiting for the bot, failed, done with the thread);
 * - `POST` `{"action":"save","windowId":…,"values":{…}}` saves one window;
 * - `POST` `{"action":"submit"}` sends it; the bot creates the same thread
 *   and card as for the Discord windows.
 * The applicant is the signed-in Discord account; writes only from the
 * dashboard origin. Convex refuses everything while the web switch is off.
 */

const json = (value: unknown, status = 200) =>
    Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
    })

const guildId = z.string().regex(/^\d{17,20}$/)

export const webApplicationRequestSchema = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("save"),
        windowId: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/),
        values: z
            .record(
                z.string().regex(/^[A-Za-z0-9_-]{1,70}$/),
                z.array(z.string().max(1100)).max(25)
            )
            .refine((values) => Object.keys(values).length <= 12),
    }),
    z.strictObject({ action: z.literal("submit") }),
])

export type WebApplicationRoutePorts<A> = {
    isWriteOrigin(request: Request): boolean
    /** The signed-in applicant; null when nobody is signed in. */
    applicant(): Promise<A | null>
    status(applicant: A, guildId: string): Promise<unknown>
    save(
        applicant: A,
        guildId: string,
        windowId: string,
        values: Record<string, string[]>
    ): Promise<unknown>
    submit(applicant: A, guildId: string): Promise<unknown>
}

export function webApplicationRoutes<A>(ports: WebApplicationRoutePorts<A>) {
    return {
        async GET(_request: Request, params: { guildId: string }) {
            if (!guildId.safeParse(params.guildId).success)
                return json({ error: "not_found" }, 404)
            const applicant = await ports.applicant().catch(() => null)
            if (!applicant) return json({ error: "unauthorized" }, 401)
            try {
                return json(await ports.status(applicant, params.guildId))
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },

        async POST(request: Request, params: { guildId: string }) {
            if (!ports.isWriteOrigin(request))
                return json({ error: "forbidden" }, 403)
            if (!guildId.safeParse(params.guildId).success)
                return json({ error: "not_found" }, 404)
            const applicant = await ports.applicant().catch(() => null)
            if (!applicant) return json({ error: "unauthorized" }, 401)
            const body = webApplicationRequestSchema.safeParse(
                await readBoundedJson(request, 32_768)
            )
            if (!body.success) return json({ error: "invalid_request" }, 400)
            try {
                return json(
                    body.data.action === "save"
                        ? await ports.save(
                              applicant,
                              params.guildId,
                              body.data.windowId,
                              body.data.values
                          )
                        : await ports.submit(applicant, params.guildId)
                )
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
    }
}
