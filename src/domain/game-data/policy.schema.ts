import { sourceSchema } from "./contracts"
import { z } from "zod"

/**
 * Zod validation of a source catalogue, for tests and operator tooling. The
 * runtime reads `LOGI_GAME_DATA_SOURCES` through `readOperatorSources`
 * (`operator-sources.ts`), which applies the same rules without Zod.
 */
export function parseSources(value: string | undefined) {
    try {
        const sources = z
            .array(sourceSchema)
            .max(100)
            .parse(value ? JSON.parse(value) : [])
        if (
            new Set(sources.map((source) => source.ref)).size !== sources.length
        )
            throw new Error()
        return sources
    } catch {
        throw new Error("Invalid game data source configuration.")
    }
}
