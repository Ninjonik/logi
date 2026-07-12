import { cacheLife } from "next/cache";

export type SteamProfile = {
  steamId: string;
  name: string;
  avatar: string;
  profileUrl: string;
};

function readXmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>|<${tag}>(.*?)<\\/${tag}>`, "i"));
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

export async function getSteamProfileCached(userId: string, steamId?: string): Promise<SteamProfile | null> {
  "use cache";

  cacheLife("hours");

  if (!steamId) {
    return null;
  }

  void userId;

  try {
    const response = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    const name = readXmlValue(xml, "steamID");
    const avatar = readXmlValue(xml, "avatarFull") || readXmlValue(xml, "avatarMedium");

    if (!name || !avatar) {
      return null;
    }

    return {
      steamId,
      name,
      avatar,
      profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
    };
  } catch {
    return null;
  }
}
