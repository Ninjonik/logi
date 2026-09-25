import { LogiStatusLink } from "@/components/app/logi-status-link"
import { getLogiServices, getLogiStatus } from "@/lib/logi-status"

export default async function StatusPage() {
    const [status, services] = await Promise.all([
        getLogiStatus(),
        getLogiServices(),
    ])

    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center px-4 py-12">
            <section className="bg-card w-full rounded-xl border p-6 shadow-sm sm:p-8">
                <p className="text-muted-foreground text-sm font-medium">
                    Logi status
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                    Service availability
                </h1>
                <div className="mt-6 text-base">
                    <LogiStatusLink status={status} />
                </div>
                <p className="text-muted-foreground mt-6 text-sm">
                    This page covers the Logi dashboard, Convex services, data
                    stores, Discord reachability, and LogiComms dependencies.
                </p>
                {services && (
                    <ul className="mt-6 divide-y rounded-lg border">
                        {services.map((service) => (
                            <li
                                key={service.name}
                                className="flex items-center justify-between px-4 py-3 text-sm"
                            >
                                <span>{service.name}</span>
                                <span
                                    className={
                                        service.online
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-amber-600 dark:text-amber-400"
                                    }
                                >
                                    <span className="mr-1.5 inline-block size-2 rounded-full bg-current" />
                                    {service.online
                                        ? "Operational"
                                        : "Degraded"}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    )
}
