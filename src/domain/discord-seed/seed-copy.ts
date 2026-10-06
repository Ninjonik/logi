/**
 * The words of the seed messages in Discord (board P5): the call in the seed
 * channel, the pinned intro, the "Ovládání serveru" control message and the
 * private replies. The views in this folder hold no fixed text; the clan
 * language module `src/lib/clan-language/seed.ts` provides this copy (Czech
 * verbatim from the board, English and German with the same keys, "ty"/"du").
 */
export type SeedMessagesCopy = {
    labels: {
        /** "Seed" in "SEED · HELL LET LOOSE". */
        seed: string
        /** "Ovládání serveru" in "OVLÁDÁNÍ SERVERU · WARDOGS". */
        control: string
    }
    game: { hell_let_loose: string; wardogs: string }
    /** Two- or three-letter weekday names, index 0 = Sunday ("Ne", "Po", …). */
    weekdays: readonly string[]
    units: { hours: string; minutes: string }
    chips: {
        seeding: string
        live: string
        ended: string
        empty: string
        filling: string
        offline: string
        unknown: string
    }
    call: {
        title: (server: string) => string
        liveTitle: string
        endedTitle: (server: string) => string
        /** "12 / 100 hráčů · živý od 40". */
        status: (
            players: string,
            capacity: string | null,
            liveFrom: string
        ) => string
        /** "43 / 100 hráčů · díky 18 seederům". */
        liveStatus: (
            players: string,
            capacity: string | null,
            seeders: number | null
        ) => string
        /** Default text while far from the threshold (P5-08). */
        startingText: (liveFrom: string) => string
        /** Default text in the last quarter (P5-11). */
        closeText: (missing: number) => string
        /** Under the bar when the admin wrote their own text (P3-19). */
        missingLine: (missing: number) => string
        startedBy: {
            manual: (name: string) => string
            schedule: (slot: string) => string
            auto: string
        }
        /** "Seed skončil v 18:25. Díky všem, kdo pomohli. Server už jede sám." */
        liveText: (time: string) => string
        endedText: {
            admin: (name: string | null) => string
            timeout: (liveFrom: string, duration: string) => string
            failed: string
        }
        /** "Seed trval 45 min". */
        duration: (duration: string) => string
        buttons: { join: string; role: string }
    }
    intro: {
        title: (clan: string) => string
        body: string
        /** "Seedujeme hlavně Vlci #1 · Public, obvykle v pátek a v sobotu odpoledne". */
        usually: (servers: string, when: string | null) => string
        /** "v pátek a v sobotu" from weekdays (0 = Sunday). */
        days: (days: readonly number[]) => string
        /** "odpoledne" for a start at `minutes` after midnight. */
        partOfDay: (minutes: number) => string
        /** Joins server names ("A a B", "A, B a C"). */
        list: (items: readonly string[]) => string
        button: string
    }
    role: {
        onTitle: string
        onBody: string
        offTitle: string
        /** "Pingy na seed ti chodit nebudou. Výzvy v #seed uvidíš dál." */
        offBody: (seedChannel: string) => string
        unavailableTitle: string
        unavailableBody: string
        failedTitle: string
    }
    control: {
        /** "3 / 100 hráčů · Carentan". */
        status: (
            players: string | null,
            capacity: string | null,
            map: string | null
        ) => string
        seedingStatus: (
            players: string | null,
            capacity: string | null,
            liveFrom: string
        ) => string
        footer: string
        buttons: {
            start: string
            stop: string
            refresh: string
            pause: string
            resume: string
        }
    }
    replies: {
        startedTitle: (server: string) => string
        /** "Výzva je v #seed a role Seed dostala ping. Panel v #servery ukazuje průběh." */
        startedBody: (
            seedChannel: string,
            pinged: boolean,
            panelChannel: string | null
        ) => string
        openCall: string
        cooldownTitle: string
        /**
         * "Seed lze znovu spustit za 1 h 20 min, ve 20:25. Mezi seedy jsou
         * aspoň 2 hodiny, …"; `at` is "HH:MM" in the clan's time zone.
         */
        cooldownBody: (
            remaining: string,
            at: string,
            cooldownMinutes: number
        ) => string
        schedule: string
        runningTitle: (server: string) => string
        runningBody: string
        alreadyLiveTitle: string
        alreadyLiveBody: (liveFrom: string) => string
        offlineTitle: string
        offlineBody: string
        notConfiguredTitle: string
        notConfiguredBody: string
        stoppedTitle: (server: string) => string
        stoppedBody: string
        notRunningTitle: string
        notRunningBody: string
        forbiddenTitle: string
        forbiddenBody: string
        panelPausedTitle: (server: string) => string
        panelPausedBody: (channel: string) => string
        panelResumedTitle: (server: string) => string
        panelResumedBody: (channel: string) => string
        panelRefreshedTitle: (server: string) => string
        panelRefreshedBody: string
        noPanelTitle: string
        noPanelBody: string
        panelNotSentTitle: string
        panelNotSentBody: string
        openInLogi: string
    }
}
