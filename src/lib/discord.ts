import { getDiscordBotToken, getDiscordClientId, getDiscordClientSecret, getDiscordRedirectUri } from "@/lib/env";

const ADMINISTRATOR_PERMISSION = BigInt(8);

export type DiscordUser = {
  id: string;
  username: string;
  avatar: string | null;
};

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

export type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

export type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

export type DiscordEmoji = {
  id: string | null;
  name: string | null;
  animated?: boolean;
};

export function getDiscordAvatarUrl(user: DiscordUser) {
  if (!user.avatar) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
}

export function getDiscordGuildIconUrl(guild: Pick<DiscordGuild, "id" | "icon">) {
  if (!guild.icon) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }

  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`;
}

export function buildDiscordAuthorizationUrl(state: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", getDiscordClientId());
  url.searchParams.set("redirect_uri", getDiscordRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  return url.toString();
}

export function buildDiscordBotInviteUrl(guildId: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", getDiscordClientId());
  url.searchParams.set("scope", "bot applications.commands");
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("disable_guild_select", "true");
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

export async function fetchDiscordGuilds(accessToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Discord guilds.");
  }

  return (await response.json()) as DiscordGuild[];
}

export function isDiscordGuildAdmin(guild: DiscordGuild) {
  if (guild.owner) {
    return true;
  }

  const permissions = BigInt(guild.permissions);
  return (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
}

export async function isBotInsideDiscordGuild(guildId: string) {
  const botToken = getDiscordBotToken();
  if (!botToken) {
    return false;
  }

  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  return response.ok;
}

async function fetchDiscordBotJson<T>(path: string) {
  const botToken = getDiscordBotToken();
  if (!botToken) {
    throw new Error("Discord bot token is missing.");
  }

  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Discord API request failed for ${path}.`);
  }

  return (await response.json()) as T;
}

export async function fetchDiscordGuildRoles(guildId: string) {
  return await fetchDiscordBotJson<DiscordRole[]>(`/guilds/${guildId}/roles`);
}

export async function fetchDiscordGuildChannels(guildId: string) {
  return await fetchDiscordBotJson<DiscordChannel[]>(`/guilds/${guildId}/channels`);
}

export async function fetchDiscordGuildEmojis(guildId: string) {
  return await fetchDiscordBotJson<DiscordEmoji[]>(`/guilds/${guildId}/emojis`);
}
