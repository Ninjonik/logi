import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getInternalAuthSecret } from "@/lib/env";
import { getRosterImageContext, getRosterImageContextCached } from "@/lib/roster-image";

export const contentType = "image/png";

// ---- Layout constants (kept in one place so the JSX and the height/width
// math below are always talking about the same numbers) ----------------
const CANVAS_WIDTH = 1800;
const OUTER_PADDING = 22;
const SIDEBAR_WIDTH = 252;
const OUTER_GAP = 16;
const CONTENT_WIDTH = CANVAS_WIDTH - OUTER_PADDING * 2 - SIDEBAR_WIDTH - OUTER_GAP; // ~1488px

const GROUP_GAP = 14; // gap between squad cards, and between group rows
const GROUP_PADDING = 24; // 12px each side, inside a group's box
const HEADER_ROW_HEIGHT = 24; // "Published roster snapshot" row
const MAIN_COLUMN_GAP = 12; // gap between that header row and the groups area
const GROUP_HEADER_HEIGHT = 26; // colored bar + group name row
const GROUP_HEADER_GAP = 8;
const SQUAD_LABEL_HEIGHT = 20; // squad name + slot count row
const SQUAD_LABEL_GAP = 8;
const ROLE_LABEL_HEIGHT = 16;
const ROLE_LABEL_GAP = 5;
const ROLE_SECTION_GAP = 8;
const PLAYER_ROW_HEIGHT = 50;       // 3-line case: assigned player
const PLAYER_ROW_HEIGHT_EMPTY = 36; // 2-line case: open slot
const PLAYER_ROW_GAP = 4;
const SAFETY_BUFFER = 16; // tiny cushion so rounding never clips the bottom edge

// Groups with this many squads or fewer are "small" — they get a fixed,
// compact width and pack together in a row. Groups with more squads are
// "large" — they stretch to fill the full content width so their squads
// don't leave a dead strip of empty space.
const SMALL_GROUP_MAX_SQUADS = 2;
const LARGE_GROUP_MAX_PER_ROW = 4;

type Player = { id?: string; ack: boolean; confirmed?: boolean; roleName?: string; roleIcon?: string; note?: string };
type Squad = { name: string; color: string; players: Player[] };
type GroupSection = { group: string; color: string; squads: Squad[] };

function getAttendanceLabel(player: Player) {
  if (player.confirmed) {
    return { text: "Confirmed", color: "#22c55e" };
  }

  if (player.ack) {
    return { text: "Ack", color: "#e2e8f0" };
  }

  return { text: "Not ack", color: "#94a3b8" };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRoleSections(players: Player[]) {
  const sections: Array<{ roleName: string; roleIcon?: string; players: Player[] }> = [];

  players.forEach((player) => {
    const roleName = player.roleName?.trim() || "Role";
    const existing = sections.find(
      (section) => section.roleName === roleName && section.roleIcon === player.roleIcon,
    );

    if (existing) {
      existing.players.push(player);
      return;
    }

    sections.push({ roleName, roleIcon: player.roleIcon, players: [player] });
  });

  return sections;
}

function resolveAssetUrl(request: Request, path?: string) {
  if (!path) return undefined;
  try {
    return new URL(path, request.url).toString();
  } catch {
    return undefined;
  }
}

// --- Small-group sizing: fixed pixel widths, packed compactly together ---
function getSmallSquadsPerRow(squadCount: number) {
  return Math.max(1, Math.min(squadCount, SMALL_GROUP_MAX_SQUADS));
}

function getSmallSquadCardWidth(perRow: number) {
  if (perRow <= 1) return 380;
  return 340;
}

function getSmallGroupWidth(squadCount: number) {
  const perRow = getSmallSquadsPerRow(squadCount);
  const squadWidth = getSmallSquadCardWidth(perRow);
  return perRow * squadWidth + (perRow - 1) * GROUP_GAP + GROUP_PADDING;
}

// --- Large-group sizing: squads stretch to fill the full content width ---
function getLargeSquadsPerRow(squadCount: number) {
  return Math.max(1, Math.min(squadCount, LARGE_GROUP_MAX_PER_ROW));
}

function getLargeSquadCardWidth(perRow: number) {
  const usable = CONTENT_WIDTH - GROUP_PADDING - (perRow - 1) * GROUP_GAP;
  return Math.floor(usable / perRow);
}

// --- Height estimation, independent of card width, used to size the canvas ---
function estimateSquadHeight(squad: Squad) {
  const roleSections = getRoleSections(squad.players);

  const sectionsHeight = roleSections.reduce((total, section) => {
    const playersHeight =
      section.players.reduce(
        (sum, player) => sum + (player.id ? PLAYER_ROW_HEIGHT : PLAYER_ROW_HEIGHT_EMPTY),
        0,
      ) + Math.max(0, section.players.length - 1) * PLAYER_ROW_GAP;
    return total + ROLE_LABEL_HEIGHT + ROLE_LABEL_GAP + playersHeight;
  }, 0);
  const sectionsGap = Math.max(0, roleSections.length - 1) * ROLE_SECTION_GAP;
  const boxHeight = GROUP_PADDING + sectionsHeight + sectionsGap;

  return SQUAD_LABEL_HEIGHT + SQUAD_LABEL_GAP + boxHeight;
}

function estimateGroupSectionHeight(squads: Squad[], perRow: number) {
  const maxSquadHeight = squads.reduce((max, squad) => Math.max(max, estimateSquadHeight(squad)), 0);
  const numRows = Math.max(1, Math.ceil(squads.length / perRow));
  const squadsAreaHeight = numRows * maxSquadHeight + Math.max(0, numRows - 1) * GROUP_GAP;
  const groupBoxHeight = GROUP_PADDING + squadsAreaHeight;
  return GROUP_HEADER_HEIGHT + GROUP_HEADER_GAP + groupBoxHeight;
}

function estimateSectionHeight(section: GroupSection) {
  if (section.squads.length <= SMALL_GROUP_MAX_SQUADS) {
    return estimateGroupSectionHeight(section.squads, getSmallSquadsPerRow(section.squads.length));
  }

  return estimateGroupSectionHeight(section.squads, getLargeSquadsPerRow(section.squads.length));
}

// Greedy left-to-right, top-to-bottom row packing — mirrors how flexWrap
// will actually lay the small-group cards out, so the height estimate matches.
function packRows<T extends { width: number; height: number }>(items: T[], maxWidth: number, gap: number) {
  const rows: T[][] = [];
  let currentRow: T[] = [];
  let currentWidth = 0;

  items.forEach((item) => {
    const neededWidth = currentRow.length === 0 ? item.width : currentWidth + gap + item.width;
    if (currentRow.length > 0 && neededWidth > maxWidth) {
      rows.push(currentRow);
      currentRow = [item];
      currentWidth = item.width;
    } else {
      currentRow.push(item);
      currentWidth = neededWidth;
    }
  });
  if (currentRow.length) rows.push(currentRow);

  const totalHeight =
    rows.reduce((sum, row) => sum + Math.max(...row.map((item) => item.height)), 0) +
    Math.max(0, rows.length - 1) * gap;

  return { rows, totalHeight };
}

function chunkItems<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== getInternalAuthSecret()) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const useFreshData = url.searchParams.get("fresh") === "1";
  const data = useFreshData
    ? await getRosterImageContext(eventId)
    : await getRosterImageContextCached(eventId);
  if (!data) {
    return NextResponse.json({ error: "Roster not available." }, { status: 404 });
  }

  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const groupsById = new Map(data.groups.map((group) => [group.id, group]));
  const assignmentsByUserId = new Map(data.assignments.map((assignment) => [assignment.userId, assignment]));

  const sortedSquads = data.roster.squads.slice().sort((a, b) => a.order - b.order);
  const squadByGroupName = new Map<string, typeof data.roster.squads>();

  sortedSquads.forEach((squad) => {
    const existing = squadByGroupName.get(squad.group) ?? [];
    existing.push(squad);
    squadByGroupName.set(squad.group, existing);
  });

  const orderedGroups = data.groups.slice().sort((a, b) => a.order - b.order);
  const rootGroups = orderedGroups.filter((group) => !group.parentId);

  const groupedSections: GroupSection[] = rootGroups.map((root) => {
    const subgroupSquads = orderedGroups
      .filter((group) => group.parentId === root.id)
      .flatMap((group) => {
        const squads = (squadByGroupName.get(group.name) ?? []).slice().sort((a, b) => a.order - b.order);
        squadByGroupName.delete(group.name);
        return squads;
      });

    const squads = [
      ...(squadByGroupName.get(root.name) ?? []).slice().sort((a, b) => a.order - b.order),
      ...subgroupSquads,
    ];
    squadByGroupName.delete(root.name);

    return {
      group: root.name,
      color: root.color,
      squads,
    };
  }).filter((section) => section.squads.length > 0);

  const remainingGroups: GroupSection[] = Array.from(squadByGroupName.entries())
    .sort(([groupNameA], [groupNameB]) => groupNameA.localeCompare(groupNameB))
    .map(([groupName, squads]) => {
      const existingGroup = data.groups.find((group) => group.name === groupName);
      return {
        group: groupName,
        color: existingGroup?.color ?? squads[0]?.color ?? "#64748b",
        squads: squads.slice().sort((a, b) => a.order - b.order),
      };
    });

  const allGroupedSections = [...groupedSections, ...remainingGroups];

  const reserveUsers = data.roster.reservePlayerIds.map((id) => usersById.get(id)).filter(Boolean);
  const totalAssigned = data.roster.squads.reduce(
    (sum, squad) => sum + squad.players.filter((player) => player.id).length,
    0,
  );

  // ---- Compute the canvas height from the actual data, so nothing gets
  // clipped no matter how many groups/squads/players this roster has. ----
  const totalGroupsHeight =
    allGroupedSections.reduce((sum, section) => sum + estimateSectionHeight(section), 0) +
    Math.max(0, allGroupedSections.length - 1) * GROUP_GAP;

  const rosterCardHeight = 102;
  const meetingCardHeight = 172;
  const reserveRowsHeight = reserveUsers.length > 0 ? Math.min(reserveUsers.length, 20) * 30 : 22;
  const reservesCardHeight = 56 + reserveRowsHeight;
  const sidebarHeight = rosterCardHeight + meetingCardHeight + reservesCardHeight + 24;
  const mainContentHeight = HEADER_ROW_HEIGHT + MAIN_COLUMN_GAP + totalGroupsHeight;

  const canvasHeight =
    OUTER_PADDING * 2 + Math.max(sidebarHeight, mainContentHeight) + SAFETY_BUFFER;

  const renderSection = (section: GroupSection) => {
    const isCompact = section.squads.length <= SMALL_GROUP_MAX_SQUADS;
    const perRow = isCompact ? getSmallSquadsPerRow(section.squads.length) : getLargeSquadsPerRow(section.squads.length);
    const squadWidth = isCompact ? getSmallSquadCardWidth(perRow) : getLargeSquadCardWidth(perRow);
    const containerWidth: string | number = isCompact ? getSmallGroupWidth(section.squads.length) : "100%";
    const squadRows = chunkItems(section.squads, perRow);

    return (
    <div
      key={section.group}
      style={{
        display: "flex",
        flexDirection: "column",
        width: typeof containerWidth === "number" ? `${containerWidth}px` : containerWidth,
        flexGrow: 0,
        flexShrink: 0,
        gap: "8px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 2px" }}>
        <div style={{ width: "5px", height: "18px", borderRadius: "999px", background: section.color }} />
        <div style={{ display: "flex", fontSize: "14px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {section.group}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "#10192a",
          border: "1px solid rgba(148,163,184,.14)",
          borderRadius: "20px",
          padding: "12px",
          gap: "10px",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: `${GROUP_GAP}px`, minWidth: 0 }}>
          {squadRows.map((row, rowIndex) => (
            <div key={`${section.group}-row-${rowIndex}`} style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: `${GROUP_GAP}px`, minWidth: 0 }}>
              {row.map((squad) => {
                const roleSections = getRoleSections(squad.players);

                return (
                  <div
                    key={`${section.group}-${squad.name}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: `${squadWidth}px`,
                      flexGrow: 0,
                      flexShrink: 0,
                      gap: "8px",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 4px", width: "100%" }}>
                      <div style={{ width: "4px", height: "14px", borderRadius: "999px", background: squad.color }} />
                      <div style={{ display: "flex", fontSize: "12px", fontWeight: 700, color: squad.color }}>{squad.name}</div>
                      <div style={{ display: "flex", fontSize: "10px", color: "#94a3b8", marginLeft: "auto", textAlign: "center" }}>
                        {`${squad.players.length} slots`}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        background: "#121b2c",
                        border: `1px solid ${squad.color}`,
                        borderRadius: "18px",
                        padding: "12px",
                        gap: "8px",
                        minWidth: 0,
                        width: "100%",
                      }}
                    >
                      {roleSections.map((section) => (
                        <div key={`${squad.name}-${section.roleName}`} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: squad.color }}>
                            {section.roleIcon ? (
                              <img
                                src={resolveAssetUrl(request, section.roleIcon)}
                                alt=""
                                width="11"
                                height="11"
                                style={{ display: "flex", objectFit: "contain" }}
                              />
                            ) : null}
                            <span>{section.roleName}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {section.players.map((player, index) => {
                              const user = player.id ? usersById.get(player.id) : null;
                              const assignment = user ? assignmentsByUserId.get(user.id) : null;
                              const primaryGroup = assignment?.primaryGroupId ? groupsById.get(assignment.primaryGroupId) : null;
                              const attendance = getAttendanceLabel(player);

                              return (
                                <div
                                  key={`${squad.name}-${section.roleName}-${index}`}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    background: user ? "#18324a" : "#182235",
                                    borderRadius: "10px",
                                    padding: "5px 8px",
                                    gap: "1px",
                                    minWidth: 0,
                                    width: "100%",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "8px", color: attendance.color, minHeight: "10px" }}>
                                    <span>{user ? attendance.text : ""}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", fontWeight: 600, color: user ? "#e2e8f0" : "#64748b", minWidth: 0 }}>
                                    {user ? (
                                      <img
                                        src={resolveAssetUrl(request, user.avatar)}
                                        alt=""
                                        width="22"
                                        height="22"
                                        style={{ display: "flex", width: "22px", height: "22px", borderRadius: "999px", objectFit: "cover", flexShrink: 0 }}
                                      />
                                    ) : null}
                                    <span style={{ display: "flex", flex: player.note ? "0 1 auto" : "1 1 auto", minWidth: 0, justifyContent: user ? "flex-start" : "center", textAlign: user ? "left" : "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {user?.name ?? "Open slot"}
                                    </span>
                                    {player.note ? (
                                      <span
                                        style={{
                                          display: "flex",
                                          marginLeft: "auto",
                                          maxWidth: "42%",
                                          borderRadius: "999px",
                                          background: "rgba(15, 23, 42, 0.7)",
                                          color: "#cbd5e1",
                                          padding: "2px 6px",
                                          fontSize: "7px",
                                          lineHeight: 1,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {player.note}
                                      </span>
                                    ) : null}
                                  </div>
                                  {user ? (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", color: "#7dd3fc", gap: "6px", textAlign: "center" }}>
                                      <span>{primaryGroup?.name ?? "Unassigned"}</span>
                                      <span>{`${user.score} pts`}</span>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  };

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #09111f 0%, #0e1728 100%)",
          color: "#f8fafc",
          padding: `${OUTER_PADDING}px`,
          fontFamily: "Arial",
          gap: `${OUTER_GAP}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: `${SIDEBAR_WIDTH}px`, gap: "12px", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid rgba(148,163,184,.18)", borderRadius: "22px", padding: "16px", background: "#121b2c" }}>
            <div style={{ display: "flex", fontSize: "12px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7dd3fc" }}>Roster</div>
            <div style={{ display: "flex", fontSize: "24px", fontWeight: 700, marginTop: "8px" }}>{data.event.name}</div>
            <div style={{ display: "flex", fontSize: "14px", color: "#94a3b8", marginTop: "6px" }}>
              {`${data.event.map ?? "Unknown"} • ${data.event.side ?? "Unknown"}`}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px", border: "1px solid rgba(148,163,184,.18)", borderRadius: "22px", padding: "16px", background: "#121b2c" }}>
            <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>Meeting</div>
            <div style={{ display: "flex", fontSize: "15px", fontWeight: 600 }}>{formatDate(data.event.meetingStart)}</div>
            <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8", marginTop: "4px" }}>Match Start</div>
            <div style={{ display: "flex", fontSize: "15px", fontWeight: 600 }}>{formatDate(data.event.gameStart)}</div>
            <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8", marginTop: "4px" }}>Stats</div>
            <div style={{ display: "flex", fontSize: "15px", fontWeight: 600 }}>{`${totalAssigned} assigned`}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid rgba(148,163,184,.18)", borderRadius: "22px", padding: "16px", background: "#121b2c" }}>
            <div style={{ display: "flex", fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#22d3ee" }}>Reserves</div>
            {reserveUsers.slice(0, 20).map((user) => (
              <div key={user!.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#cbd5e1", minWidth: 0 }}>
                <img
                  src={resolveAssetUrl(request, user!.avatar)}
                  alt=""
                  width="22"
                  height="22"
                  style={{ display: "flex", width: "22px", height: "22px", borderRadius: "999px", objectFit: "cover", flexShrink: 0 }}
                />
                <span style={{ display: "flex", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user!.name}</span>
                <span style={{ color: "#94a3b8", flexShrink: 0 }}>{user!.score}</span>
              </div>
            ))}
            {reserveUsers.length === 0 ? <div style={{ display: "flex", fontSize: "13px", color: "#64748b" }}>No reserves</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: `${MAIN_COLUMN_GAP}px`, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 4px" }}>
            <div style={{ display: "flex", fontSize: "12px", color: "#64748b" }}>{formatDate(data.roster.updatedAt)}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: `${GROUP_GAP}px`, minWidth: 0 }}>
            {allGroupedSections.map((section) => renderSection(section))}
          </div>
        </div>
      </div>
    ),
    { width: CANVAS_WIDTH, height: Math.round(canvasHeight) },
  );
}
