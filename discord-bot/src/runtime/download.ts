export class DownloadTooLarge extends Error {
    constructor() {
        super("Download exceeds byte limit.")
    }
}

export function cancelResponse(response: Pick<Response, "body">) {
    void response.body?.cancel().catch(() => {})
}

/** Enforce actual streamed bytes, including absent or dishonest Content-Length. */
export async function readResponseBytes(
    response: Response,
    maxBytes: number,
    signal?: AbortSignal
): Promise<Uint8Array> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
        throw new Error("Invalid download limit.")
    const length = Number(response.headers.get("content-length"))
    if (Number.isFinite(length) && length > maxBytes) {
        cancelResponse(response)
        throw new DownloadTooLarge()
    }
    if (!response.body) throw new Error("Empty download.")
    const reader = response.body.getReader()
    let bytes = new Uint8Array(Math.min(maxBytes, 65536))
    let size = 0
    const abort = () => {
        void reader.cancel().catch(() => {})
    }
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) abort()
    try {
        while (true) {
            signal?.throwIfAborted()
            const part = await reader.read()
            signal?.throwIfAborted()
            if (part.done) break
            const nextSize = size + part.value.byteLength
            if (nextSize > maxBytes) throw new DownloadTooLarge()
            if (nextSize > bytes.byteLength) {
                const grown = new Uint8Array(
                    Math.min(maxBytes, Math.max(nextSize, bytes.byteLength * 2))
                )
                grown.set(bytes)
                bytes = grown
            }
            bytes.set(part.value, size)
            size = nextSize
        }
        return bytes.slice(0, size)
    } catch (error) {
        void reader.cancel().catch(() => {})
        throw error
    } finally {
        signal?.removeEventListener("abort", abort)
        reader.releaseLock()
    }
}
