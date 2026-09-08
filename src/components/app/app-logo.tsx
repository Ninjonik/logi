import { Logo } from "@/components/logo"

export function AppLogo() {
    return (
        <div className="flex size-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#4b6b37,#c9a84e)] text-black shadow-lg shadow-black/20 2xl:size-9 2xl:rounded-xl">
            <Logo size={20} className="size-4 2xl:size-5" />
        </div>
    )
}
