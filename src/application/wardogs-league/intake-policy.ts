export function acceptMessageVersion(
    previous: { version?: number; deleted?: boolean } | null,
    version: number,
    deleted: boolean
) {
    if (!Number.isSafeInteger(version) || version < 0 || previous?.deleted)
        return false
    return deleted || !previous || version > (previous.version ?? 0)
}
