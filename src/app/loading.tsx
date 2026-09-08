export default function Loading() {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090b] text-white">
            <div className="absolute -top-48 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="relative text-center">
                <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/10 shadow-[0_0_70px_rgba(245,158,11,.24)]">
                    <span className="size-6 animate-ping rounded-full border-2 border-amber-300" />
                    <span className="absolute size-2 rounded-full bg-amber-300" />
                </div>
                <p className="mt-6 text-sm font-semibold tracking-[0.28em] text-amber-200 uppercase">
                    Preparing the operation
                </p>
            </div>
        </div>
    )
}
