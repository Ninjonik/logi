export function DashboardPageLoading() {
    return (
        <div
            className="flex min-h-[calc(100dvh-var(--header-height)-var(--footer-height))] flex-1 items-center justify-center"
            aria-live="polite"
            aria-busy="true"
        >
            <span className="border-primary/25 border-t-primary size-9 animate-spin rounded-full border-2" />
        </div>
    )
}
