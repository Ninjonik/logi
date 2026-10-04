import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { artworkPath } from "./render"

const artworkCache = new Map<
    string,
    Promise<{ path: string; name: string; url: string } | null>
>()
export async function panelArtwork(game: string, map?: string | null) {
    const candidates = [
        ...new Set([artworkPath(game, map), artworkPath(game)]),
    ].filter((p): p is string => Boolean(p))
    for (const candidate of candidates) {
        let pending = artworkCache.get(candidate)
        if (!pending) {
            pending = (async () => {
                try {
                    // Only catalog paths enter here; never use a provider URL/path.
                    const location = new URL(
                        `../../../public${candidate}`,
                        import.meta.url
                    )
                    const bytes = await readFile(location)
                    if (bytes.byteLength > 8 * 1024 * 1024) return null
                    const hash = createHash("sha256")
                        .update(bytes)
                        .digest("hex")
                        .slice(0, 12)
                    const file = candidate.split("/").at(-1)!
                    const dot = file.lastIndexOf(".")
                    const name = `logi-panel-${file.slice(0, dot)}-${hash}${file.slice(dot)}`
                    return {
                        path: fileURLToPath(location),
                        name,
                        url: `attachment://${name}`,
                    }
                } catch {
                    return null
                }
            })()
            artworkCache.set(candidate, pending)
        }
        const result = await pending
        if (result) return result
    }
    return null
}
export async function factionAssets() {
    return Promise.all(
        (["valkyra", "manticore", "lonestar"] as const).map(async (faction) => {
            const bytes = await readFile(
                new URL(
                    `../../../public/stratmap/icons/wardogs/${faction}.webp`,
                    import.meta.url
                )
            )
            if (bytes.byteLength > 256 * 1024)
                throw new Error("Faction emoji exceeds Discord size limit.")
            const digest = createHash("sha256")
                .update(bytes)
                .digest("hex")
                .slice(0, 8)
            return {
                faction,
                name: `logi_${faction}_${digest}`,
                image: `data:image/webp;base64,${bytes.toString("base64")}`,
            }
        })
    )
}
