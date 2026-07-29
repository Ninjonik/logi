export function parseDiscordCustomEmoji(value?: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return null;

  const [, animatedFlag, name, id] = match;
  const animated = animatedFlag === "a";

  return {
    id,
    name,
    animated,
    imageUrl: `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=64`,
  };
}

export function isDiscordCustomEmoji(value?: string | null) {
  return Boolean(parseDiscordCustomEmoji(value));
}
