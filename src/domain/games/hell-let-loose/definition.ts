import type { GameDefinition } from "../game-definition";

export const hellLetLooseGame: GameDefinition = {
  id: "hell-let-loose",
  displayName: "Hell Let Loose",
  membership: {
    statuses: [
      { key: "pending", label: "Pending", canAppearInRoster: false, canSignUpForMatches: false },
      { key: "recruit", label: "Recruit", canAppearInRoster: true, canSignUpForMatches: true },
      { key: "member", label: "Member", canAppearInRoster: true, canSignUpForMatches: true },
      { key: "reserve_member", label: "Reserve member", canAppearInRoster: true, canSignUpForMatches: true },
      { key: "mercenary", label: "Mercenary", canAppearInRoster: true, canSignUpForMatches: true },
    ],
  },
};
