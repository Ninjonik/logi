import {
    panelBannerImageAlt,
    panelImageRequestHash,
    panelImageRequestSchema,
    panelScoreImageAlt,
    type PanelBannerImage,
    type PanelImageRequest,
    type PanelScoreImage,
} from "../../../src/domain/discord-publications/panel-image-model"
import {
    decideScoreImageRender,
    panelImageFileName,
    type RenderedImageState,
} from "../../../src/domain/discord-publications/panel-graphics"

/** A rendered panel image ready to attach to the panel message. */
export type PanelImageAttachment = {
    /** Versioned name, e.g. `skore-vlci1-2041-3fa9c2.png` (P7-23). */
    name: string
    bytes: Uint8Array
    /** Alt text in the clan language (P7-10, P7-30). */
    description: string
    hash: string
    /** False when the previous image was kept (unchanged or within 60 s). */
    fresh: boolean
}
export type PanelImagePorts = {
    /** Renders one request through the web renderer; throws on failure. */
    request(request: PanelImageRequest): Promise<Uint8Array>
    now(): number
}
type Kept = PanelImageAttachment & RenderedImageState

/**
 * Generated panel images per panel. The score image is redrawn only when its
 * content changed and at most once per 60 s (P7-B02, P7-22); the banner only
 * when its content changed. When rendering fails the last image stays, and
 * without one the caller shows the text panel alone.
 */
export function createPanelImageSource(ports: PanelImagePorts) {
    const kept = new Map<string, Kept>()
    async function produce(
        key: string,
        request: PanelImageRequest,
        options: {
            throttle: boolean
            name(hash: string, at: number): string
            alt: string
        }
    ): Promise<PanelImageAttachment | null> {
        // Never send what the renderer would refuse; a bad model is a caller bug.
        const valid = panelImageRequestSchema.safeParse(request)
        if (!valid.success) return kept.get(key) ?? null
        const hash = panelImageRequestHash(valid.data)
        const previous = kept.get(key) ?? null
        const now = ports.now()
        const decision = decideScoreImageRender({
            previous,
            hash,
            now,
            minIntervalMs: options.throttle ? undefined : 0,
        })
        if (decision.action === "reuse" && previous)
            return { ...previous, fresh: false }
        try {
            const bytes = await ports.request(valid.data)
            const next: Kept = {
                name: options.name(hash, now),
                bytes,
                description: options.alt,
                hash,
                renderedAt: now,
                fresh: true,
            }
            kept.set(key, next)
            return next
        } catch {
            return previous ? { ...previous, fresh: false } : null
        }
    }
    return {
        score(panelKey: string, model: PanelScoreImage) {
            return produce(
                `${panelKey}:score`,
                { kind: "score", model },
                {
                    throttle: true,
                    name: (hash, at) =>
                        panelImageFileName({
                            kind: "skore",
                            serverName: model.serverName,
                            at,
                            timeZone: model.timeZone,
                            hash,
                            extension: "png",
                        }),
                    alt: panelScoreImageAlt(model),
                }
            )
        },
        banner(
            panelKey: string,
            model: PanelBannerImage,
            serverName: string,
            timeZone: string
        ) {
            return produce(
                `${panelKey}:banner`,
                { kind: "banner", model },
                {
                    throttle: false,
                    name: (hash, at) =>
                        panelImageFileName({
                            kind: "banner",
                            serverName,
                            at,
                            timeZone,
                            hash,
                            extension: "png",
                        }),
                    alt: panelBannerImageAlt(model),
                }
            )
        },
        /** Drops a deleted panel's images. */
        forget(panelKey: string) {
            kept.delete(`${panelKey}:score`)
            kept.delete(`${panelKey}:banner`)
        },
    }
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024
/**
 * Asks the web renderer for one image over the internal origin, carrying the
 * internal secret in the body as the bot's other web calls do.
 */
export function webPanelImageRequest(config: {
    origin: string
    secret: string
    fetch?: typeof fetch
    timeoutMs?: number
}) {
    const send = config.fetch ?? fetch
    return async (request: PanelImageRequest): Promise<Uint8Array> => {
        const response = await send(
            new URL("/api/discord/panel-image", config.origin),
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ secret: config.secret, request }),
                signal: AbortSignal.timeout(config.timeoutMs ?? 45_000),
            }
        )
        const length = Number(response.headers.get("content-length"))
        if (
            !response.ok ||
            response.headers.get("content-type") !== "image/png" ||
            (Number.isFinite(length) && length > MAX_IMAGE_BYTES)
        )
            throw new Error(`Panel image unavailable (${response.status}).`)
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.byteLength > MAX_IMAGE_BYTES)
            throw new Error("Panel image too large.")
        return bytes
    }
}
