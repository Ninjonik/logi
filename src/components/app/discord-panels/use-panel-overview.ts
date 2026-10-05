"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { panelPollInterval } from "@/domain/discord-publications/panel-list"

import { readPanelOverview, type PanelOverviewResponse } from "./panels-api"

export type PanelOverviewState = {
    overview: PanelOverviewResponse | null
    status: "loading" | "ready" | "failed"
    /** When the overview was last read, for "teď" against the server clock. */
    readAt: number | null
}

/**
 * The overview of "Panely v Discordu", read again every 5 s while the page is
 * open and every 2 s while the bot owes an answer (P1-B09, P2-B11), so
 * "Čeká na bota" turns into "Zveřejněno" without a reload. Polling pauses
 * while the tab is hidden.
 */
export function usePanelOverview(serverId: string) {
    const [state, setState] = useState<PanelOverviewState>({
        overview: null,
        status: "loading",
        readAt: null,
    })
    const generation = useRef(0)

    const refresh = useCallback(async () => {
        const run = ++generation.current
        const overview = await readPanelOverview(serverId).catch(() => null)
        if (run !== generation.current) return
        setState((current) =>
            overview
                ? { overview, status: "ready", readAt: Date.now() }
                : {
                      ...current,
                      status: current.overview ? current.status : "failed",
                  }
        )
    }, [serverId])

    const states = state.overview
        ? [
              ...state.overview.panels.map((panel) => panel.state),
              ...state.overview.controls.map((control) => control.state),
          ]
        : []
    const interval = panelPollInterval(states)

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined
        let stopped = false
        const tick = async () => {
            if (!document.hidden) await refresh()
            if (!stopped) timer = setTimeout(tick, interval)
        }
        timer = setTimeout(tick, state.overview ? interval : 0)
        return () => {
            stopped = true
            if (timer) clearTimeout(timer)
        }
        // The overview itself is not a dependency: each read reschedules.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, interval])

    return { ...state, refresh }
}

/** "Now", ticking every second, so "před 12 s" counts up between reads. */
export function useNow(intervalMs = 1000) {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs)
        return () => clearInterval(timer)
    }, [intervalMs])
    return now
}
