import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LyricsResponse = {
  plainLyrics: string | null;
  syncedLyrics: string | null;
  source: string;
};

// Clean up title to improve search accuracy
function cleanTitle(title: string) {
  return title
    .replace(/\(.*\)/g, "") // remove parentheticals like (Official Video)
    .replace(/\[.*\]/g, "")
    .replace(/official/i, "")
    .replace(/video/i, "")
    .replace(/audio/i, "")
    .replace(/lyric/i, "")
    .replace(/remix/i, "")
    .replace(/ft\..*/i, "")
    .replace(/feat\..*/i, "")
    .trim();
}

export const getLyricsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string(),
        artist: z.string(),
        duration: z.number().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const qTitle = encodeURIComponent(cleanTitle(data.title));
      const qArtist = encodeURIComponent(data.artist.split(",")[0].trim()); // just use first artist

      const url = `https://lrclib.net/api/search?track_name=${qTitle}&artist_name=${qArtist}`;
      
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      
      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) return null;

      // Find best match: prioritize synced lyrics
      let bestMatch = results.find((r: any) => r.syncedLyrics);
      if (!bestMatch) bestMatch = results.find((r: any) => r.plainLyrics);
      if (!bestMatch) bestMatch = results[0];

      if (!bestMatch.plainLyrics && !bestMatch.syncedLyrics) return null;

      return {
        plainLyrics: bestMatch.plainLyrics ?? null,
        syncedLyrics: bestMatch.syncedLyrics ?? null,
        source: "LRCLIB",
      } as LyricsResponse;
    } catch (e) {
      console.error("Failed to fetch lyrics:", e);
      return null;
    }
  });
