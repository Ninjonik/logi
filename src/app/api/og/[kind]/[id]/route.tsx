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
    <div style={{ height: "100%", width: "100%", display: "flex", background: "linear-gradient(135deg, #0b1020 0%, #202b5b 58%, #6d28d9 100%)", color: "white", padding: "64px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}><div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 5, color: "#c4b5fd" }}>LOGI</div><div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: "#a5b4fc" }}>{card.eyebrow}</div><div style={{ display: "flex", marginTop: 18, maxWidth: 780, fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>{card.title}</div><div style={{ display: "flex", marginTop: 28, fontSize: 42, fontWeight: 700 }}>{card.primary}</div><div style={{ display: "flex", marginTop: 12, fontSize: 24, color: "#d1d5db" }}>{card.secondary}</div></div></div>{card.image ? <img src={card.image} width="220" height="220" style={{ borderRadius: 32, objectFit: "cover", alignSelf: "flex-end", border: "3px solid rgba(255,255,255,.25)" }} /> : <div style={{ display: "flex", alignSelf: "flex-end", width: 220, height: 220, borderRadius: 32, background: "rgba(255,255,255,.1)", alignItems: "center", justifyContent: "center", fontSize: 70, fontWeight: 700 }}>VS</div>}</div>,
    { width: 1200, height: 630 },
  );
  const image = new Uint8Array(await rendered.arrayBuffer());
  publicImageCache.set(cacheKey, image);
  return pngResponse(image);
}
