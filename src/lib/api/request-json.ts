/** Bound streamed bytes before decoding or allocating the complete JSON body. */
export async function readBoundedJson(
    request: Request,
    maxBytes: number
): Promise<unknown> {
    const reader = request.body?.getReader()
    if (!reader) return null
    const decoder = new TextDecoder()
    let bytes = 0,
        text = ""
    try {
        while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            bytes += chunk.value.byteLength
            if (bytes > maxBytes) {
                await reader.cancel()
                return null
            }
            text += decoder.decode(chunk.value, { stream: true })
        }
        return JSON.parse(text + decoder.decode()) as unknown
    } catch {
        return null
    } finally {
        reader.releaseLock()
    }
}
