export function validateWebhookUrl(value: string, production: boolean) {
    if (value.length > 2_048) return "Webhook URL is too long."
    let url: URL
    try {
        url = new URL(value)
    } catch {
        return "Webhook URL must be a valid URL."
    }
    if (url.username || url.password)
        return "Webhook URLs cannot contain credentials."
    if (production && url.protocol !== "https:")
        return "Webhook URLs must use HTTPS in production."
    const host = url.hostname.toLowerCase()
    if (
        production &&
        (host === "localhost" ||
            host === "::1" ||
            /^127\./.test(host) ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host))
    )
        return "Webhook URLs cannot target a private network."
    return null
}
