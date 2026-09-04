import { ImageResponse } from "next/og";

import { publicImageCache } from "@/lib/public-image-cache";
import { getPublicClan, getPublicMatch, getPublicPlayerProfile } from "@/lib/read-models/public-profiles";

type Props = { params: Promise<{ kind: string; id: string }> };

function pngResponse(image: Uint8Array) {
  const body = new Uint8Array(image.byteLength);
  body.set(image);
  return new Response(body.buffer, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
}

export async function GET(request: Request, { params }: Props) {
  const { kind, id } = await params;
  const version = new URL(request.url).searchParams.get("v") ?? "current";
  const cacheKey = `${kind}:${id}:${version}`;
  const cached = publicImageCache.get(cacheKey);
  if (cached) return pngResponse(cached);
  let card: { eyebrow: string; title: string; primary: string; secondary: string; image: string | null } | null = null;
  if (kind === "player") {
    const player = await getPublicPlayerProfile(id);
    if (player) card = { eyebrow: "LOGI PLAYER PROFILE", title: player.name, primary: `${player.stats.kd.toFixed(2)} K/D`, secondary: `${player.stats.matches} recorded matches`, image: player.avatar };
  } else if (kind === "clan") {
    const clan = await getPublicClan(id);
    if (clan) card = { eyebrow: "LOGI CLAN", title: clan.name, primary: `${Math.round(clan.stats.winRate * 100)}% win rate`, secondary: `${clan.stats.wins} wins · ${clan.memberCount} active members`, image: clan.avatar };
  } else if (kind === "match") {
    const match = await getPublicMatch(id);
    if (match) card = { eyebrow: "LOGI MATCH RESULT", title: match.raw.map.pretty_name, primary: `${match.raw.result.allied} – ${match.raw.result.axis}`, secondary: `${match.raw.player_stats.length} players recorded`, image: null };
  }
  if (!card) return new Response("Not found", { status: 404 });

  const rendered = new ImageResponse(
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#1c1917", color: "#fafaf9", padding: "48px 54px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 14 }}><div style={{ display: "flex", width: 14, height: 14, borderRadius: 99, background: "#a78bfa" }} /><div style={{ display: "flex", fontSize: 23, fontWeight: 800, letterSpacing: 4 }}>LOGI</div><div style={{ display: "flex", fontSize: 18, color: "#a8a29e", letterSpacing: 2 }}>{card.eyebrow}</div></div><div style={{ display: "flex", border: "1px solid #57534e", borderRadius: 99, padding: "8px 16px", fontSize: 17, fontWeight: 700, color: "#ddd6fe" }}>RECORDED</div></div>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 34 }}>{card.image ? <img src={card.image} width="122" height="122" style={{ borderRadius: 61, objectFit: "cover", border: "4px solid #a78bfa" }} /> : <div style={{ display: "flex", width: 122, height: 122, borderRadius: 28, background: "#292524", alignItems: "center", justifyContent: "center", color: "#fbbf24", fontSize: 38, fontWeight: 900 }}>VS</div>}<div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", maxWidth: 870, fontSize: 59, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>{card.title}</div><div style={{ display: "flex", marginTop: 12, color: "#a8a29e", fontSize: 24 }}>{card.secondary}</div></div></div>
      <div style={{ display: "flex", marginTop: 32, paddingTop: 24, borderTop: "1px solid #57534e", gap: 24 }}><div style={{ display: "flex", flexDirection: "column", flex: 1 }}><div style={{ display: "flex", color: "#a8a29e", fontSize: 19, fontWeight: 700 }}>HIGHLIGHT</div><div style={{ display: "flex", marginTop: 7, fontSize: 34, fontWeight: 800 }}>{card.primary}</div></div><div style={{ display: "flex", flexDirection: "column", flex: 2 }}><div style={{ display: "flex", color: "#a8a29e", fontSize: 19, fontWeight: 700 }}>SUMMARY</div><div style={{ display: "flex", marginTop: 7, fontSize: 27, fontWeight: 700 }}>{card.secondary}</div></div></div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}><div style={{ display: "flex", fontWeight: 800 }}>Performance snapshot</div><div style={{ display: "flex", color: "#d6d3d1" }}>{card.eyebrow}</div></div><div style={{ display: "flex", height: 22, borderRadius: 5, overflow: "hidden", background: "#44403c", marginTop: 13 }}><div style={{ display: "flex", width: "72%", background: "#8b5cf6" }} /></div></div>
      <div style={{ display: "flex", marginTop: "auto", color: "#78716c", fontSize: 17, letterSpacing: 1.5 }}>LOGI.GG · COMMUNITY PERFORMANCE</div>
    </div>,
    { width: 1200, height: 630 },
  );
  const image = new Uint8Array(await rendered.arrayBuffer());
  publicImageCache.set(cacheKey, image);
  return pngResponse(image);
}
