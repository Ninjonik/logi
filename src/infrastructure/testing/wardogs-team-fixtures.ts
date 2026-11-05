import {
    autoImportSettingsSchema,
    type TeamFixture,
} from "../../domain/wardogs-league/team-api"
import { defaultMatchTemplate } from "../../domain/events/match-templates"
export const fixture: TeamFixture = {
    id: "fixture_42",
    number: 42,
    status: "SCHEDULED",
    scheduledAt: "2027-01-20T19:00:00.000Z",
    map: "Zestafona",
    gameMode: "Control",
    competition: {
        competition: "League",
        season: "2027",
        division: "A",
        round: 3,
    },
    participants: [
        {
            team: { code: "VLK", name: "Valkyria" },
            faction: "VALKYRA",
            finishingPosition: null,
            points: null,
            noShow: false,
        },
        {
            team: { code: "NEW", name: "New team" },
            faction: null,
            finishingPosition: null,
            points: null,
            noShow: false,
        },
    ],
}
export const template = {
    ...defaultMatchTemplate("default", "League"),
    gameId: "wardogs",
}
export const settings = autoImportSettingsSchema.parse({
    enabled: true,
    teamCode: "VLK",
    templateId: "default",
    announcementChannelId: "123456789012345678",
    eventInfoChannelId: "123456789012345679",
})
