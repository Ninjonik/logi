export type DefaultGroupSeed = {
  id: string;
  name: string;
  color: string;
  order: number;
  parentId?: string;
  description: string;
};

export const defaultGroupSeeds: DefaultGroupSeed[] = [
  {
    id: "group-command",
    name: "Command",
    color: "#d4a017",
    order: 0,
    description: "Commander-level coordination and top-level battlefield control.",
  },
  {
    id: "group-infantry",
    name: "Infantry",
    color: "#dc2626",
    order: 1,
    description: "Frontline rifle squads and flexible line infantry roles.",
  },
  {
    id: "group-armor",
    name: "Armor",
    color: "#7c3aed",
    order: 2,
    description: "Tank crews, armor commanders, and vehicle-focused specialists.",
  },
  {
    id: "group-recon",
    name: "Recon",
    color: "#0f766e",
    order: 0,
    parentId: "group-infantry",
    description: "Recon squads, scouting, spotting, and sniper coordination.",
  },
  {
    id: "group-defense",
    name: "Defense",
    color: "#f59e0b",
    order: 1,
    parentId: "group-infantry",
    description: "Defensive anchors, hold squads, and objective security roles.",
  },
  {
    id: "group-flex",
    name: "Flex",
    color: "#64748b",
    order: 2,
    parentId: "group-infantry",
    description: "Reserve players and flexible coverage across multiple squad types.",
  },
  {
    id: "group-artillery",
    name: "Artillery",
    color: "#b45309",
    order: 0,
    parentId: "group-command",
    description: "Backline artillery operators and fire support specialists.",
  },
];
