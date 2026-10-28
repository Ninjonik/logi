import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const publicDirectory = path.join(process.cwd(), "public")
const discordImageHosts = new Set([
    "cdn.discordapp.com",
    "media.discordapp.net",
])

/** Inline bundled assets without an HTTP self-request; bound optional avatar reads. */
export async function loadRosterImageAsset(source: string, siteUrl: string) {
    try {
        const url = new URL(source, siteUrl)
        let bytes: Buffer
        if (url.origin === new URL(siteUrl).origin) {
            const filename = path.resolve(
                publicDirectory,
                `.${decodeURIComponent(url.pathname)}`
            )
            if (!filename.startsWith(`${publicDirectory}${path.sep}`))
                return undefined
            bytes = await readFile(filename)
        } else {
            if (
                url.protocol !== "https:" ||
                !discordImageHosts.has(url.hostname)
            )
                return undefined
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
                redirect: "error",
            })
            if (!response.ok) return undefined
            bytes = Buffer.from(await response.arrayBuffer())
        }
        const image = await sharp(bytes, { limitInputPixels: 16_000_000 })
            .resize({
                width: 128,
                height: 128,
                fit: "inside",
                withoutEnlargement: true,
            })
            .png()
            .toBuffer()
        return `data:image/png;base64,${image.toString("base64")}`
    } catch {
        // Avatars and decorative icons must never prevent roster publication.
        return undefined
    }
}
