/**
 * JSON with object keys in sorted order at every level, so two payloads with
 * the same content give the same string whatever order they were built in.
 * `undefined` values are left out, as `JSON.stringify` leaves them out.
 */
export function canonicalJson(value: unknown): string {
    return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys)
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>
        const sorted: Record<string, unknown> = {}
        for (const key of Object.keys(record).sort())
            if (record[key] !== undefined) sorted[key] = sortKeys(record[key])
        return sorted
    }
    return value
}
