/**
 * How many reminders the reminders route queued, from its `{ queued }` body;
 * null for any other body, so a malformed answer is reported as a failure.
 */
export function queuedReminders(body: unknown): number | null {
    if (!body || typeof body !== "object" || !("queued" in body)) return null
    const { queued } = body as { queued: unknown }
    return typeof queued === "number" && Number.isInteger(queued) && queued >= 0
        ? queued
        : null
}
