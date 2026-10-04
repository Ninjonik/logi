/**
 * Message for a failed dashboard event write. The admin and same-origin gate
 * answers with the bare code `forbidden`, which is localized here; any other
 * error text is already user-safe.
 */
export function eventWriteErrorMessage(
    body: unknown,
    messages: { forbidden: string; fallback: string }
): string {
    const error =
        body && typeof body === "object" && "error" in body
            ? (body as { error?: unknown }).error
            : undefined
    if (error === "forbidden") return messages.forbidden
    return typeof error === "string" && error.trim() ? error : messages.fallback
}
