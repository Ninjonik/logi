/**
 * The time a dynamic server render is for. Pages read it once and pass it
 * down, so the time-dependent parts of one page agree with each other and pure
 * rules receive the time as an input.
 */
export function requestTime(): number {
    return Date.now()
}
