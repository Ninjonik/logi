import { SERVICE_STATUS_INTERVAL_SECONDS } from "../domain/discord-messages/service-status"

/** Share each result, including failures, for five minutes within this process. */
export function createStatusReader<T>(url: string) {
    let nextCheck = 0
    let result: Promise<T[] | null> | undefined

    return function read(): Promise<T[] | null> {
        const now = Date.now()
        if (result && now < nextCheck) return result
        nextCheck = now + SERVICE_STATUS_INTERVAL_SECONDS * 1000
        result = (async () => {
            try {
                const response = await fetch(url, {
                    cache: "no-store",
                    signal: AbortSignal.timeout(10_000),
                })
                if (!response.ok) return null
                const data: unknown = await response.json()
                return Array.isArray(data) &&
                    data.every(
                        (item: unknown) =>
                            typeof item === "object" &&
                            item !== null &&
                            "name" in item &&
                            typeof item.name === "string" &&
                            "group_id" in item &&
                            typeof item.group_id === "number" &&
                            "online" in item &&
                            typeof item.online === "boolean"
                    )
                    ? (data as T[])
                    : null
            } catch {
                return null
            }
        })()
        return result
    }
}
