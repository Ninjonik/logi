import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { getInternalAuthSecret } from "@/lib/env";
import { getClanDiscordMessages, getIntlLocaleForClanLanguage } from "@/lib/clan-language";
import { getRosterImageContext, getRosterImageContextCached } from "@/lib/roster-image";

export const contentType = "image/png";

// ---- Layout constants (kept in one place so the JSX and the height/width
// math below are always talking about the same numbers) ----------------
const CANVAS_WIDTH = 2400;
const OUTER_PADDING = 30;
const SIDEBAR_WIDTH = 336;
const OUTER_GAP = 21;
const CONTENT_WIDTH = CANVAS_WIDTH - OUTER_PADDING * 2 - SIDEBAR_WIDTH - OUTER_GAP; // ~1488px

const GROUP_GAP = 18; // gap between squad cards, and between group rows
const GROUP_PADDING = 32; // 16px each side, inside a group's box
const HEADER_ROW_HEIGHT = 32; // "Published roster snapshot" row
const MAIN_COLUMN_GAP = 16; // gap between that header row and the groups area
const GROUP_HEADER_HEIGHT = 34; // colored bar + group name row
const GROUP_HEADER_GAP = 8;
const SQUAD_LABEL_HEIGHT = 26; // squad name + slot count row
const SQUAD_LABEL_GAP = 10;
const ROLE_LABEL_HEIGHT = 20;
const ROLE_LABEL_GAP = 7;
const ROLE_SECTION_GAP = 10;
const PLAYER_ROW_HEIGHT = 34;
const PLAYER_ROW_HEIGHT_EMPTY = 24;
const PLAYER_ROW_GAP = 6;
const SAFETY_BUFFER = 24; // tiny cushion so rounding never clips the bottom edge

// Groups with this many squads or fewer are "small" — they get a fixed,
// compact width and pack together in a row. Groups with more squads are
// "large" — they stretch to fill the full content width so their squads
// don't leave a dead strip of empty space.
const SMALL_GROUP_MAX_SQUADS = 2;
const LARGE_GROUP_MAX_PER_ROW = 4;

type Player = { id?: string; ack: boolean; confirmed?: boolean; roleName?: string; roleIcon?: string; note?: string };
type Squad = { name: string; color: string; players: Player[] };
type GroupSection = { group: string; color: string; squads: Squad[] };

function getAttendanceStyle(player: Player) {
  if (player.confirmed) {
    return { background: "#166534", showCheck: true };
  }

  if (player.ack) {
    return { background: "#166534", showCheck: false };
  }

  return { background: "#18324a", showCheck: false };
}

function formatDate(value: string, locale: string, timezone?: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
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

// True only for meaningful values — filters out null/undefined, empty
// strings, and the "-" placeholder some forms use for "not set".
function hasValue(value?: string | null): value is string {
  return typeof value === "string" && value.trim() !== "" && value.trim() !== "-";
}

// Wraps text into lines at an approximate character width, then truncates
// to a fixed number of lines with an ellipsis. Card heights depend on line
// counts being deterministic, since there's no dynamic text measurement
// available in this render environment.
function wrapAndTruncate(text: string, maxCharsPerLine: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const allLines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      allLines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) allLines.push(current);

  if (allLines.length <= maxLines) return allLines;

  const lines = allLines.slice(0, maxLines);
  let lastLine = lines[maxLines - 1];
  while (lastLine.length > Math.max(0, maxCharsPerLine - 1)) {
    lastLine = lastLine.slice(0, -1);
  }
  lines[maxLines - 1] = `${lastLine.trimEnd()}…`;
  return lines;
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
  const cachedOrFreshData = useFreshData
    ? await getRosterImageContext(eventId)
    : await getRosterImageContextCached(eventId);
  const data =
    cachedOrFreshData && !cachedOrFreshData.config
      ? await getRosterImageContext(eventId)
      : cachedOrFreshData;
  if (!data) {
    return NextResponse.json({ error: "Roster not available." }, { status: 404 });
  }

  const clanLanguage = data.config?.defaultLanguage ?? "en";
  const configTimezone = data.config?.timezone;
  const messages = getClanDiscordMessages(clanLanguage);
  const intlLocale = getIntlLocaleForClanLanguage(clanLanguage);

  const usersById = new Map(data.users.map((user) => [user.id, user]));

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

  const DETAIL_CHARS_PER_LINE = 36;
  const DETAIL_MAX_LINES = 3;
  const DETAIL_LINE_HEIGHT = 15;

  const showServer = hasValue(data.event.server);
  const showServerPassword = hasValue(data.event.serverPassword);
  const showCap = hasValue(data.event.cap);
  const descriptionLines = hasValue(data.event.description)
    ? wrapAndTruncate(data.event.description, DETAIL_CHARS_PER_LINE, DETAIL_MAX_LINES)
    : [];
  const notesLines = hasValue(data.event.notes)
    ? wrapAndTruncate(data.event.notes, DETAIL_CHARS_PER_LINE, DETAIL_MAX_LINES)
    : [];
  const hasDetails = descriptionLines.length > 0 || notesLines.length > 0;

  const rosterCardHeight = 102 + (showServer ? 20 : 0) + (showServerPassword ? 20 : 0);
  const meetingCardHeight = 172 + (showCap ? 34 : 0);
  const reserveRowsHeight = reserveUsers.length > 0 ? Math.min(reserveUsers.length, 20) * 30 : 22;
  const reservesCardHeight = 56 + reserveRowsHeight;
  const detailsCardHeight = hasDetails
    ? 32 +
    18 +
    (descriptionLines.length > 0 ? 18 + descriptionLines.length * DETAIL_LINE_HEIGHT : 0) +
    (notesLines.length > 0 ? (descriptionLines.length > 0 ? 8 : 0) + 18 + notesLines.length * DETAIL_LINE_HEIGHT : 0)
    : 0;
  const sidebarHeight =
    rosterCardHeight +
    meetingCardHeight +
    reservesCardHeight +
    (hasDetails ? detailsCardHeight + 12 : 0) +
    24;
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
                        <div style={{ display: "flex", fontSize: "16px", fontWeight: 700, color: squad.color }}>{squad.name}</div>
                        <div style={{ display: "flex", fontSize: "10px", color: "#94a3b8", marginLeft: "auto", textAlign: "center" }}>
                          {`${squad.players.length} ${messages.rosterImage.slots}`}
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
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: squad.color }}>
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
                                const attendance = getAttendanceStyle(player);

                                return (
                                  <div
                                    key={`${squad.name}-${section.roleName}-${index}`}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      background: user ? attendance.background : "#182235",
                                      borderRadius: "10px",
                                      padding: "6px 10px",
                                      minWidth: 0,
                                      width: "100%",
                                    }}
                                  >
                                    {user ? (
                                      <img
                                        src={resolveAssetUrl(request, user.avatar)}
                                        alt=""
                                        width="20"
                                        height="20"
                                        style={{ display: "flex", width: "20px", height: "20px", borderRadius: "999px", objectFit: "cover", flexShrink: 0 }}
                                      />
                                    ) : null}
                                    <span
                                      style={{
                                        display: "flex",
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        color: user ? "#e2e8f0" : "#64748b",
                                        justifyContent: user ? "flex-start" : "center",
                                        textAlign: user ? "left" : "center",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                    {user?.name ?? messages.rosterImage.openSlot}
                                  </span>
                                    {player.note ? (
                                      <span
                                        style={{
                                          display: "flex",
                                          flexShrink: 0,
                                          alignItems: "center",
                                          justifyContent: "center",
                                          maxWidth: "40%",
                                          borderRadius: "999px",
                                          background: "rgba(125, 211, 252, 0.12)",
                                          border: "1px solid rgba(125, 211, 252, 0.35)",
                                          color: "#dbeafe",
                                          padding: "3px 8px",
                                          fontSize: "8px",
                                          fontWeight: 700,
                                          lineHeight: 1.1,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                      {player.note}
                                    </span>
                                    ) : null}
                                    {user && attendance.showCheck ? (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                          width: "12px",
                                          height: "12px",
                                          borderRadius: "999px",
                                          background: "#22c55e",
                                        }}
                                      >
                                        <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
                                          <path d="M3 8.5L6.5 12L13 4" stroke="#0b1a10" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
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
            <div style={{ display: "flex", fontSize: "14px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7dd3fc" }}>{messages.rosterImage.roster}</div>
            <div style={{ display: "flex", fontSize: "24px", fontWeight: 700, marginTop: "8px" }}>{data.event.name}</div>
            <div style={{ display: "flex", fontSize: "14px", color: "#94a3b8", marginTop: "6px" }}>
              {`${data.event.map ?? messages.rosterImage.unknown} • ${data.event.side ?? messages.rosterImage.unknown}`}
            </div>
            {showServer ? (
              <div style={{ display: "flex", fontSize: "12px", color: "#7dd3fc", marginTop: "8px" }}>
                {`${messages.rosterImage.server}: ${data.event.server}`}
              </div>
            ) : null}
            {showServerPassword ? (
              <div style={{ display: "flex", fontSize: "12px", color: "#7dd3fc", marginTop: "2px" }}>
                {`${messages.rosterImage.password}: ${data.event.serverPassword}`}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px", border: "1px solid rgba(148,163,184,.18)", borderRadius: "22px", padding: "16px", background: "#121b2c" }}>
            <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" }}>{messages.rosterImage.meeting}</div>
            <div style={{ display: "flex", fontSize: "15px", fontWeight: 600 }}>{formatDate(data.event.meetingStart, intlLocale, configTimezone)}</div>
            <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8", marginTop: "4px" }}>{messages.rosterImage.matchStart}</div>
            <div style={{ display: "flex", fontSize: "15px", fontWeight: 600 }}>{formatDate(data.event.gameStart, intlLocale, configTimezone)}</div>
            <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8", marginTop: "4px" }}>{messages.rosterImage.stats}</div>
            <div style={{ display: "flex", fontSize: "15px", fontWeight: 600 }}>{`${totalAssigned} ${messages.rosterImage.assigned}`}</div>
            {showCap ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8", marginTop: "4px" }}>{messages.rosterImage.cap}</div>
                <div style={{ display: "flex", fontSize: "15px", fontWeight: 600 }}>{data.event.cap}</div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid rgba(148,163,184,.18)", borderRadius: "22px", padding: "16px", background: "#121b2c" }}>
            <div style={{ display: "flex", fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#22d3ee" }}>{messages.rosterImage.reserves}</div>
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
              </div>
            ))}
            {reserveUsers.length === 0 ? <div style={{ display: "flex", fontSize: "13px", color: "#64748b" }}>{messages.rosterImage.noReserves}</div> : null}
          </div>
          {hasDetails ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid rgba(148,163,184,.18)", borderRadius: "22px", padding: "16px", background: "#121b2c" }}>
              <div style={{ display: "flex", fontSize: "12px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8" }}>{messages.rosterImage.details}</div>
              {descriptionLines.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>{messages.rosterImage.description}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {descriptionLines.map((line, index) => (
                      <div key={`desc-${index}`} style={{ display: "flex", fontSize: "12px", color: "#cbd5e1", lineHeight: "15px" }}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : null}
              {notesLines.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>{messages.rosterImage.notes}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {notesLines.map((line, index) => (
                      <div key={`note-${index}`} style={{ display: "flex", fontSize: "12px", color: "#cbd5e1", lineHeight: "15px" }}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: `${MAIN_COLUMN_GAP}px`, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 4px" }}>
            <div style={{ display: "flex", fontSize: "12px", color: "#64748b" }}>{formatDate(data.roster.updatedAt, intlLocale, configTimezone)}</div>
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
