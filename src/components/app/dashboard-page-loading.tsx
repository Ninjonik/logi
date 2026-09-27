export function DashboardPageLoading() {
    return (
        <div
            className="flex min-h-[calc(100dvh-var(--header-height,0px)-var(--footer-height,0px))] flex-1 flex-col items-center justify-center gap-3"
            aria-live="polite"
            aria-busy="true"
            role="status"
        >
            <span className="border-primary/25 border-t-primary size-10 animate-spin rounded-full border-[2.5px]" />
            <span className="sr-only">Loading workspace</span>
        </div>
    )
}
