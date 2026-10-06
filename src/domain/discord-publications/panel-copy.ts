/**
 * The words of the channel panels and their private replies (boards L3, P4,
 * P5, P6). The views in this folder hold no fixed text: they take this copy,
 * which `src/lib/clan-language/panels.ts` provides in the clan language
 * (Czech verbatim from the boards, English and German with the same keys).
 */

export type LivePanelCopy = {
    /** Header labels, laid out upper case ("ŽIVÝ SERVER · HELL LET LOOSE"). */
    labelLive: string
    /** A server panel in a channel `@everyone` cannot view (P4-22). */
    labelClan: string
    /** The live panel with the score switched off (L3-43). */
    labelStatus: string
    labelCombined: string
    game: { hell_let_loose: string; wardogs: string }
    state: {
        live: string
        /** The live chip of the server-status variant (L3-43). */
        online: string
        empty: string
        seeding: string
        offline: string
        paused: string
        stale: string
    }
    players: (count: string, capacity: string) => string
    playersShort: (count: string, capacity: string) => string
    playerCount: (count: string) => string
    queue: (count: string) => string
    timeLeft: (minutes: string) => string
    liveFrom: (count: string) => string
    serverNotResponding: string
    lastData: (time: string) => string
    pausedByAdmin: string
    offlineText: string
    emptyText: string
    emptySeedHint: (channel: string) => string
    seedJoin: string
    seedRunning: (time: string) => string
    seedCallIn: (channel: string) => string
    allies: string
    axis: string
    topKills: string
    topCash: string
    clanPlaying: (count: string) => string
    nextMap: (map: string) => string
    nextMapInline: (map: string) => string
    matchRunning: (time: string) => string
    address: string
    password: string
    joinCode: string
    points: string
    newMap: string
    combinedTitle: string
    /** P7-19: "seedujeme 9 / 40" in a row of "Naše servery". */
    seedingProgress: (count: string, target: string) => string
    /** P7-19: the banner subtitle "Naše servery · Hell Let Loose a Wardogs". */
    combinedBanner: (games: string[]) => string
    buttons: {
        join: string
        players: string
        report: string
        openCall: string
        joinServer: (name: string) => string
    }
}

export type PlayerListCopy = {
    label: string
    title: (map: string, players: string) => string
    titleNoMap: (players: string) => string
    metaHll: (time: string) => string
    metaWardogs: (time: string) => string
    sideHeader: (side: string, count: string) => string
    noSide: string
    sortedNote: string
    pageButton: (page: string, pages: string) => string
    empty: string
    unavailableTitle: string
    unavailableBody: string
    outdatedTitle: string
    outdatedBody: string
    previous: string
    next: string
}

export type ResultPanelCopy = {
    label: string
    corrected: string
    outcomes: { win: string; loss: string; draw: string }
    place: (place: string) => string
    confirmedBy: (name: string) => string
    correctedAt: (time: string, previous: string) => string
    match: (number: string) => string
    /** "#38 Friendly": a League fixture with its type (P6-38). */
    fixture: (number: string, type: string) => string
    points: string
    viewMatch: string
}

export type CalendarPanelCopy = {
    label: (clan: string) => string
    title: string
    next: string
    relative: (time: string) => string
    signupUntil: (time: string) => string
    allDay: string
    open: string
    timesNote: string
    empty: string
    training: string
    match: string
    /** L3-14: a competition match's type word with its round, "ECL, 3. kolo". */
    withRound: (type: string, round: string) => string
}

export type CompetitionPanelCopy = {
    title: string
    titleAfterRound: (round: string) => string
    points: (points: string) => string
    wins: (wins: number, matches: number) => string
    nextMatch: (team: string, details: string) => string
    round: (round: string) => string
    open: string
    rules: string
    empty: string
}

export type ReportCopy = {
    pickerLabel: (server: string) => string
    pickerTitle: string
    pickerMeta: (map: string, time: string) => string
    pickerMetaNoMap: (time: string) => string
    pickerText: string
    selectPlaceholder: string
    onServer: (side: string) => string
    onServerNoSide: string
    otherPlayer: string
    otherPlayerHint: string
    previous: string
    next: string
    modalTitle: (player: string) => string
    modalTitleOther: string
    playerField: string
    reasonField: string
    reasonPlaceholder: string
    whenField: string
    whenPlaceholder: string
    evidenceField: string
    evidencePlaceholder: string
    sentTitle: string
    sentBody: (thread: string) => string
    openThread: string
    savedTitle: string
    savedBody: string
    cannotSendTitle: string
    limitBody: string
    waitBody: string
    tooManyFormsBody: string
    expiredBody: string
    reasonBody: string
    evidenceBody: string
    playerBody: string
    noAccessBody: string
    unavailableBody: string
    threadName: (number: string, player: string) => string
    cardLabel: (number: string) => string
    observedIdentity: string
    manualIdentity: string
    reportedBy: (reporter: string) => string
    when: string
    evidence: string
    footer: string
}

export type PanelMessagesCopy = {
    live: LivePanelCopy
    players: PlayerListCopy
    results: ResultPanelCopy
    calendarPanel: CalendarPanelCopy
    competition: CompetitionPanelCopy
    report: ReportCopy
}
