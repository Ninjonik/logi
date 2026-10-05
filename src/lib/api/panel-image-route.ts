import { createHash, timingSafeEqual } from "node:crypto"

import {
    panelImageRequestHash,
    panelImageRequestSchema,
    type PanelImageRequest,
} from "@/domain/discord-publications/panel-image-model"
import { readBoundedJson } from "@/lib/api/request-json"

/** A score model is a few hundred bytes; anything near this bound is not one. */
export const PANEL_IMAGE_MAX_BODY_BYTES = 16 * 1024

export type PanelImageRoutePorts = {
    /** The deployment's internal secret, shared with the bot. */
    secret(): string
    render(request: PanelImageRequest): Promise<Uint8Array>
    cache: {
        get(key: string): Uint8Array | undefined
        set(key: string, image: Uint8Array): void
    }
}

const json = (body: unknown, status: number) =>
    Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store" },
    })
function png(image: Uint8Array, hash: string) {
    const body = new Uint8Array(image.byteLength)
    body.set(image)
    return new Response(body.buffer, {
        headers: {
            "Content-Type": "image/png",
            // A private answer to an authenticated POST; never stored by proxies.
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Logi-Image-Hash": hash,
        },
    })
}
/** Constant-time comparison of digests, so neither length nor prefix leaks. */
function sameSecret(given: unknown, expected: string) {
    if (typeof given !== "string" || !given || !expected) return false
    const digest = (value: string) =>
        createHash("sha256").update(value).digest()
    return timingSafeEqual(digest(given), digest(expected))
}

/**
 * `POST /api/discord/panel-image` with `{ secret, request }`: the bot sends
 * the internal secret the same way it does for cache revalidation and gets
 * the PNG of a validated panel image model. The route reads no workspace data
 * by ID, so there is nothing to enumerate; identical content is served from
 * the cache and concurrent identical requests render once.
 */
export function panelImageHandler(ports: PanelImageRoutePorts) {
    const inflight = new Map<string, Promise<Uint8Array>>()
    return async function POST(request: Request): Promise<Response> {
        const body = await readBoundedJson(request, PANEL_IMAGE_MAX_BODY_BYTES)
        const fields =
            body && typeof body === "object"
                ? (body as { secret?: unknown; request?: unknown })
                : null
        // Authentication comes first: an unauthenticated caller learns nothing
        // about the model, not even whether it would validate.
        if (!fields || !sameSecret(fields.secret, ports.secret()))
            return json({ error: "unauthorized" }, 401)
        const parsed = panelImageRequestSchema.safeParse(fields.request)
        if (!parsed.success) return json({ error: "invalid_request" }, 400)
        const hash = panelImageRequestHash(parsed.data)
        const cached = ports.cache.get(hash)
        if (cached) return png(cached, hash)
        let pending = inflight.get(hash)
        if (!pending) {
            pending = ports.render(parsed.data)
            inflight.set(hash, pending)
        }
        try {
            const image = await pending
            ports.cache.set(hash, image)
            return png(image, hash)
        } catch {
            return json({ error: "render_failed" }, 503)
        } finally {
            if (inflight.get(hash) === pending) inflight.delete(hash)
        }
    }
}
