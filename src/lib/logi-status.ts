export type LogiStatus = "operational" | "degraded" | "unknown"

type StatusService = {
    name: string
    group_id: number
    online: boolean
}

const statusApiUrl =
    process.env.LOGI_STATUS_API_URL ?? "http://127.0.0.1:8303/api/services"

export async function getLogiStatus(): Promise<LogiStatus> {
    const services = await getLogiServices()
    if (!services) return "unknown"
    return services.every((service) => service.online)
        ? "operational"
        : "degraded"
}

export async function getLogiServices(): Promise<StatusService[] | null> {
    try {
        const response = await fetch(statusApiUrl, {
            next: { revalidate: 30 },
        })
        if (!response.ok) return null

        const services = (await response.json()) as StatusService[]
        const logiServices = services.filter(
            (service) => service.group_id === 2
        )
        return logiServices.length > 0 ? logiServices : null
    } catch {
        return null
    }
}
