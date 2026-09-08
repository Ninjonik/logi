export type CollectionFilter = { path: string; value: string }

type RecordValue = Record<string, unknown>

function stringify(value: unknown) {
    if (value === null) return "null"
    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    )
        return String(value)
    return undefined
}

function matchesValue(value: unknown, expected: string): boolean {
    if (Array.isArray(value))
        return value.some((item) => matchesValue(item, expected))
    return stringify(value) === expected
}

/** Applies every filter as an AND condition. Filter paths may only address a
 * top-level field or one field within a top-level object. */
export function filterCollection<T extends RecordValue>(
    items: readonly T[],
    filters: readonly CollectionFilter[]
) {
    return items.filter((item) =>
        filters.every(({ path, value }) => {
            const [first, second] = path.split(".")
            const topLevelValue = item[first]
            const candidate =
                second &&
                topLevelValue &&
                typeof topLevelValue === "object" &&
                !Array.isArray(topLevelValue)
                    ? (topLevelValue as RecordValue)[second]
                    : topLevelValue
            return matchesValue(candidate, value)
        })
    )
}

export function paginateCollection<T>(
    items: readonly T[],
    offset: number,
    limit: number
) {
    const page = items.slice(offset, offset + limit)
    const nextOffset = offset + page.length
    return {
        page,
        total: items.length,
        offset,
        limit,
        nextOffset: nextOffset < items.length ? nextOffset : null,
    }
}
