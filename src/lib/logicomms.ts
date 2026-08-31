type LogiCommsRelease = { platforms?: { "windows-x86_64"?: { url?: string } } };

const latestReleaseUrl = "https://logicomms.igportals.eu/releases/latest.json";

export async function getLatestLogiCommsWindowsDownload() {
  try {
    const response = await fetch(latestReleaseUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const release = await response.json() as LogiCommsRelease;
    const url = release.platforms?.["windows-x86_64"]?.url;
    return url?.startsWith("https://") ? url : null;
  } catch {
    return null;
  }
}
