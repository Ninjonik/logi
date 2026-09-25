export type GameMembershipStatusDefinition = {
  key: string;
  label: string;
  canAppearInRoster: boolean;
  canSignUpForMatches: boolean;
};

export type GameDefinition = {
  id: string;
  displayName: string;
  membership: {
    statuses: GameMembershipStatusDefinition[];
  };
};
