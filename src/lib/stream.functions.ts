import { createServerFn } from "@tanstack/react-start";

// Piped instances — curated list of currently reliable ones
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.leptons.xyz",
  "https://api.piped.private.coffee",
  "https://pipedapi.drgns.space",
  "https://pipedapi.ducks.party",
];

// Invidious instances as a secondary fallback (different API format)
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.jing.rocks",
  "https://yt.cdaut.de",
  "https://invidious.privacyredirect.com",
];

/**
 * Try to get audio stream URL from a Piped instance.
 */
async function tryPiped(videoId: string): Promise<string | null> {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();

      if (json && Array.isArray(json.audioStreams) && json.audioStreams.length > 0) {
        // Sort by bitrate descending to get best quality
        const streams = [...json.audioStreams].sort((a: any, b: any) => {
          return (b.bitrate || 0) - (a.bitrate || 0);
        });

        // Prefer m4a/mp4 for universal compatibility (especially iOS background)
        let best = streams.find(
          (s: any) => s.mimeType && (s.mimeType.includes("mp4") || s.mimeType.includes("m4a")),
        );
        if (!best) best = streams.find((s: any) => s.url);
        if (!best) best = streams[0];

        if (best?.url) return best.url as string;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Try to get audio stream URL from an Invidious instance.
 * Invidious API: /api/v1/videos/:id → adaptiveFormats[]
 */
async function tryInvidious(videoId: string): Promise<string | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = await res.json();

      if (json && Array.isArray(json.adaptiveFormats)) {
        // Filter to audio-only streams
        const audioStreams = json.adaptiveFormats.filter(
          (f: any) => f.type && f.type.startsWith("audio/"),
        );

        if (audioStreams.length === 0) continue;

        // Sort by bitrate descending
        audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

        // Prefer m4a/mp4
        let best = audioStreams.find(
          (s: any) => s.type && (s.type.includes("mp4") || s.type.includes("m4a")),
        );
        if (!best) best = audioStreams[0];

        if (best?.url) return best.url as string;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export const getAudioStreamFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { videoId: string };
    return { videoId: String(d?.videoId ?? "") };
  })
  .handler(async ({ data }) => {
    if (!data.videoId) throw new Error("No video ID provided");

    // Strategy 1: Piped
    const pipedUrl = await tryPiped(data.videoId);
    if (pipedUrl) return { url: pipedUrl };

    // Strategy 2: Invidious
    const invUrl = await tryInvidious(data.videoId);
    if (invUrl) return { url: invUrl };

    throw new Error("Could not extract audio stream from any source");
  });
