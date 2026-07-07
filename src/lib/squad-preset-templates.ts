import type { SquadPresetSquad } from "@/types/domain";

export const roleIconOptions = [
  "/img/roles/icn_commander.png",
  "/img/roles/icn_tankCommand.png",
  "/img/roles/icn_tankCrew.png",
  "/img/roles/icn_officer.png",
  "/img/roles/icn_sniper.png",
  "/img/roles/icn_recon.png",
  "/img/roles/icn_Rifleman.png",
  "/img/roles/icn_support.png",
  "/img/roles/icn_mg.png",
  "/img/roles/icn_assault.png",
  "/img/roles/icn_autorifleman.png",
  "/img/roles/icn_anti-tank.png",
  "/img/roles/icn_eng.png",
  "/img/roles/icn_medic.png",
] as const;

export function createHllStarterSquadPreset(): SquadPresetSquad[] {
  return [
    {
      name: "Commander",
      group: "Command",
      order: 0,
      color: "#d4a017",
      icon: "/img/roles/icn_commander.png",
      roles: [{ name: "Commander", color: "#d4a017", icon: "/img/roles/icn_commander.png", count: 1 }],
    },
    {
      name: "Artillery",
      group: "Artillery",
      order: 0,
      color: "#b45309",
      icon: "/img/roles/icn_mg.png",
      roles: [{ name: "Artillery", color: "#b45309", icon: "/img/roles/icn_mg.png", count: 1 }],
    },
    {
      name: "Red",
      group: "Infantry",
      order: 2,
      color: "#dc2626",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", color: "#dc2626", icon: "/img/roles/icn_officer.png", count: 2 },
        { name: "Infantry", color: "#dc2626", icon: "/img/roles/icn_Rifleman.png", count: 5 },
      ],
    },
    {
      name: "Blue",
      group: "Infantry",
      order: 3,
      color: "#2563eb",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", color: "#2563eb", icon: "/img/roles/icn_officer.png", count: 2 },
        { name: "Infantry", color: "#2563eb", icon: "/img/roles/icn_Rifleman.png", count: 5 },
      ],
    },
    {
      name: "Green",
      group: "Infantry",
      order: 4,
      color: "#16a34a",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", color: "#16a34a", icon: "/img/roles/icn_officer.png", count: 2 },
        { name: "Infantry", color: "#16a34a", icon: "/img/roles/icn_Rifleman.png", count: 5 },
      ],
    },
    {
      name: "Defend",
      group: "Defense",
      order: 5,
      color: "#f59e0b",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", color: "#f59e0b", icon: "/img/roles/icn_officer.png", count: 2 },
        { name: "Infantry", color: "#f59e0b", icon: "/img/roles/icn_Rifleman.png", count: 3 },
      ],
    },
    {
      name: "Recon 1",
      group: "Recon",
      order: 6,
      color: "#0f766e",
      icon: "/img/roles/icn_recon.png",
      roles: [
        { name: "Squad Leader", color: "#0f766e", icon: "/img/roles/icn_officer.png", count: 1 },
        { name: "Sniper", color: "#0f766e", icon: "/img/roles/icn_sniper.png", count: 1 },
      ],
    },
    {
      name: "Recon 2",
      group: "Recon",
      order: 6,
      color: "#0f766e",
      icon: "/img/roles/icn_recon.png",
      roles: [
        { name: "Squad Leader", color: "#0f766e", icon: "/img/roles/icn_officer.png", count: 1 },
        { name: "Sniper", color: "#0f766e", icon: "/img/roles/icn_sniper.png", count: 1 },
      ],
    },
    {
      name: "Flex",
      group: "Flex",
      order: 7,
      color: "#64748b",
      icon: "/img/roles/icn_officer.png",
      roles: [
        { name: "Squad Leader", color: "#64748b", icon: "/img/roles/icn_officer.png", count: 2 },
        { name: "Infantry", color: "#64748b", icon: "/img/roles/icn_Rifleman.png", count: 3 },
      ],
    },
    {
      name: "Tank 1",
      group: "Armor",
      order: 8,
      color: "#7c3aed",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", color: "#7c3aed", icon: "/img/roles/icn_tankCommand.png", count: 1 },
        { name: "Gunner", color: "#7c3aed", icon: "/img/roles/icn_tankCrew.png", count: 1 },
        { name: "Driver", color: "#7c3aed", icon: "/img/roles/icn_tankCrew.png", count: 1 },
      ],
    },
    {
      name: "Tank 2",
      group: "Armor",
      order: 9,
      color: "#8b5cf6",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", color: "#8b5cf6", icon: "/img/roles/icn_tankCommand.png", count: 1 },
        { name: "Gunner", color: "#8b5cf6", icon: "/img/roles/icn_tankCrew.png", count: 1 },
        { name: "Driver", color: "#8b5cf6", icon: "/img/roles/icn_tankCrew.png", count: 1 },
      ],
    },
    {
      name: "Tank 3",
      group: "Armor",
      order: 10,
      color: "#8b5cf6",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", color: "#8b5cf6", icon: "/img/roles/icn_tankCommand.png", count: 1 },
        { name: "Gunner", color: "#8b5cf6", icon: "/img/roles/icn_tankCrew.png", count: 1 },
        { name: "Driver", color: "#8b5cf6", icon: "/img/roles/icn_tankCrew.png", count: 1 },
      ],
    },
    {
      name: "Tank 4",
      group: "Armor",
      order: 10,
      color: "#8b5cf6",
      icon: "/img/roles/icn_tankCommand.png",
      roles: [
        { name: "Tank Commander", color: "#8b5cf6", icon: "/img/roles/icn_tankCommand.png", count: 1 },
        { name: "Gunner", color: "#8b5cf6", icon: "/img/roles/icn_tankCrew.png", count: 1 },
        { name: "Driver", color: "#8b5cf6", icon: "/img/roles/icn_tankCrew.png", count: 1 },
      ],
    },
  ];
}
