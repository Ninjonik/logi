import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
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
