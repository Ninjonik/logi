/** Five preparation attempts, with bounded backoff; ambiguous sends never retry. */
export function recapRetryDelayMs(attempt: number): number | null {
    return [60_000, 300_000, 900_000, 3_600_000][attempt - 1] ?? null
}
