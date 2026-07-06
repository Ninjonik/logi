import { getDiscordClientId, getDiscordClientSecret, getDiscordRedirectUri } from "@/lib/env";

export type DiscordUser = {
  id: string;
  username: string;
  avatar: string | null;
};

export function getDiscordAvatarUrl(user: DiscordUser) {
  if (!user.avatar) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
}

export function buildDiscordAuthorizationUrl(state: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", getDiscordClientId());
  url.searchParams.set("redirect_uri", getDiscordRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeDiscordCode(code: string) {
  const body = new URLSearchParams({
    client_id: getDiscordClientId(),
    client_secret: getDiscordClientSecret(),
    grant_type: "authorization_code",
    code,
    redirect_uri: getDiscordRedirectUri(),
  });

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Discord OAuth code.");
  }

  return (await response.json()) as { access_token: string };
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Discord user profile.");
  }

  return (await response.json()) as DiscordUser;
}
