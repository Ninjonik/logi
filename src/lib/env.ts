function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getFirstEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function getSiteUrl() {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

export function getDiscordClientId() {
  return getFirstEnv("DISCORD_CLIENT_ID", "AUTH_DISCORD_ID") ?? requireEnv("DISCORD_CLIENT_ID");
}

export function getDiscordClientSecret() {
  return getFirstEnv("DISCORD_CLIENT_SECRET", "AUTH_DISCORD_SECRET") ?? requireEnv("DISCORD_CLIENT_SECRET");
}

export function getDiscordRedirectUri() {
  return process.env.DISCORD_REDIRECT_URI ?? `${getSiteUrl()}/api/auth/callback/discord`;
}

export function getDiscordBotToken() {
  return process.env.DISCORD_BOT_TOKEN;
}

export function getJwtSecret() {
  return getFirstEnv("JWT_SECRET", "AUTH_PRIVATE_KEY") ?? requireEnv("JWT_SECRET");
}

export function getInternalAuthSecret() {
  return process.env.INTERNAL_AUTH_SECRET ?? getJwtSecret();
}
