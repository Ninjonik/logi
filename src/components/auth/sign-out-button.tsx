"use client"

import { LogOut } from "lucide-react"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function SignOutButton({ label }: { label: string }) {
    return (
        <form action="/api/auth/logout" method="post">
            <DropdownMenuItem
                asChild
                className="cursor-pointer"
                onSelect={(event) => event.preventDefault()}
            >
                <button type="submit" className="w-full">
                    <LogOut />
                    {label}
                </button>
            </DropdownMenuItem>
        </form>
    )
}
