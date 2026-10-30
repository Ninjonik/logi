"use client"
import type { WalkStep } from "@/domain/onboarding/walkthrough"
import { createContext, useContext } from "react"
export type WalkRuntime = {
    step: WalkStep | null
    phase: number
    workspaceId?: string
    active: boolean
    limited: boolean
    canManage: boolean
    exampleNow: number
    next(): void
}
export const WalkthroughContext = createContext<WalkRuntime>({
    step: null,
    phase: 6,
    active: false,
    limited: false,
    canManage: false,
    exampleNow: 0,
    next() {},
})
export const useWalkthrough = () => useContext(WalkthroughContext)
