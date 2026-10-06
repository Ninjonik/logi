/**
 * The shape of the `/link` copy (boards L4 1.5 and M3 1.2). The words live
 * in `src/lib/clan-language/game-accounts.ts` in cs, en and de; the views
 * take them as input and hold no fixed words.
 */

import type { GameAccountPlatform } from "./platform-id"

export type GameAccountPlatformCopy = {
    /** "Steam", "Epic Games". */
    name: string
    /** The field and the ID's name: "Steam64 ID". */
    idName: string
    /** Under the platform in the select: "Steam64 ID, 17 číslic". */
    option: string
    /** "Najdi své Steam64 ID". */
    guideTitle: string
    /** "Je to 17místné číslo, které začíná 7656119." */
    guideHelp: string
    /** The three guide steps. */
    steps: readonly [string, string, string]
    /** "Zadat Steam64 ID". */
    enter: string
    /** "Propojit Steam" (the window's title). */
    modalTitle: string
    /** "76561198…". */
    placeholder: string
    /** "Tohle nevypadá jako Steam64 ID". */
    invalidTitle: string
    /**
     * "Má 17 číslic a začíná 7656119. Najdeš ho podle {guide}." `{guide}` is
     * `guide.guideInline` ("návodu"), a link to the platform's guide (M3-11).
     */
    invalidBody: string
}

export type GameAccountCopy = {
    /** "Herní účty", the label of every card. */
    label: string
    /** "Herní účty · {platform}". */
    platformLabel: string
    platforms: Record<GameAccountPlatform, GameAccountPlatformCopy>
    /** "Jiné ID" for an old stored ID without a platform. */
    otherPlatform: string
    start: {
        title: string
        body: string
        platformPlaceholder: string
        declaration: string
        verifySteam: string
    }
    playedBefore: {
        title: string
        placeholder: string
        yes: string
        yesDescription: string
        no: string
        noDescription: string
    }
    search: {
        modalTitle: string
        label: string
        placeholder: string
        resultsTitle: string
        resultsPlaceholder: string
        resultsNote: string
        searchAgain: string
        enterManually: string
        /** "naposledy {date}". */
        lastSeen: string
        /** "naposledy {date} na {server}". */
        lastSeenOn: string
        noneTitle: string
        noneBody: string
        unavailableTitle: string
        unavailableBody: string
    }
    guide: {
        guideLink: string
        /** The guide as a word in a sentence: "návodu", "The guide". */
        guideInline: string
        back: string
        /** Inside the application the guide's button (L4-60). */
        continueApplication: string
    }
    linked: {
        title: string
        /** "{platform} propojený". */
        chip: string
        /** "{platform} je propojený". */
        successTitle: string
        successBody: string
        addAnother: string
        unlink: string
    }
    unlink: {
        title: string
        placeholder: string
        usedByApplication: string
        statsStop: string
        back: string
    }
    errors: {
        retry: string
        staleTitle: string
        staleBody: string
        takenTitle: string
        takenBody: string
    }
}
