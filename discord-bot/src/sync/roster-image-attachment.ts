import {
    cancelResponse,
    DownloadTooLarge,
    readResponseBytes,
} from "../runtime/download"
import { setTimeout } from "node:timers/promises"
import { AttachmentBuilder } from "discord.js"
import { createHash } from "node:crypto"

/** Finish the render and download before replacing a Discord message's media. */
export async function fetchRosterImageAttachment(
    url: URL,
    eventName: string,
    fetchImage: typeof fetch = fetch
) {
    const image = await downloadRosterImage(url, fetchImage)
    const hash = createHash("sha256").update(image).digest("hex")
    const name = `published-roster-${hash}.png`
    return {
        attachment: new AttachmentBuilder(image, {
            name,
            description: `${eventName} roster`,
        }),
        mediaUrl: `attachment://${name}`,
    }
}

async function downloadRosterImage(url: URL, fetchImage: typeof fetch) {
    const signal = AbortSignal.timeout(45_000)
    // Retry the whole download: a reset can happen after successful headers.
    for (let attempt = 0; ; attempt++) {
        let response: Response
        try {
            response = await fetchImage(url, {
                signal,
            })
            if (
                response.ok &&
                response.headers.get("content-type")?.startsWith("image/png")
            )
                return Buffer.from(
                    await readResponseBytes(response, 25 * 1024 * 1024, signal)
                )
        } catch (error) {
            if (
                error instanceof DownloadTooLarge ||
                attempt >= 2 ||
                signal.aborted
            )
                throw error
            await setTimeout(250 * 2 ** attempt)
            continue
        }
        if (
            (response.status === 429 || response.status >= 500) &&
            attempt < 2
        ) {
            await response.body?.cancel()
            await setTimeout(250 * 2 ** attempt)
            continue
        }
        cancelResponse(response)
        throw new Error(`Unable to render roster image (${response.status}).`)
    }
}
