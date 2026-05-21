import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LyricsResponse = {
  plainLyrics: string | null;
  syncedLyrics: string | null;
  source: string;
};

// Clean up title to improve search accuracy, but be careful with regional content
function cleanTitle(title: string) {
  return (
    title
      .replace(/\(official.*\)/i, "")
      .replace(/\[official.*\]/i, "")
      .replace(/\(lyric.*\)/i, "")
      .replace(/\[lyric.*\]/i, "")
      .replace(/\(audio.*\)/i, "")
      .replace(/\[audio.*\]/i, "")
      .replace(/\(video.*\)/i, "")
      .replace(/\[video.*\]/i, "")
      .replace(/official video/i, "")
      .replace(/lyric video/i, "")
      .replace(/audio video/i, "")
      // Do NOT remove "remix" or general parentheticals which might contain important regional variants
      .trim()
  );
}

async function scrapeGenius(query: string): Promise<string | null> {
  try {
    // 1. Search Genius
    const searchUrl = `https://genius.com/api/search/multi?per_page=1&q=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const hit = searchData?.response?.sections?.find((s: any) => s.type === "song")?.hits?.[0];
    if (!hit?.result?.url) return null;

    // 2. Scrape Lyrics Page
    const pageUrl = hit.result.url;
    const pageRes = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!pageRes.ok) return null;

    const html = await pageRes.text();

    // Parse Genius Lyrics (they use data-lyrics-container attributes)
    // We'll use a simple regex approach since we don't have a DOM parser here
    const lyricsContainers = html.match(/<div data-lyrics-container="true".*?>(.*?)<\/div>/gs);
    if (!lyricsContainers) return null;

    let fullLyrics = lyricsContainers.join("\n");
    // Strip HTML tags and replace <br> with newlines
    fullLyrics = fullLyrics
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
      .trim();

    return fullLyrics || null;
  } catch (e) {
    console.error("Genius scrape failed:", e);
    return null;
  }
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
      const qTitle = cleanTitle(data.title);
      const qArtist = data.artist.split(",")[0].split("&")[0].trim(); // just use first artist

      const query = `${qTitle} ${qArtist}`.trim();

      // Strategy 1: LRCLIB (Best for synced lyrics)
      try {
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0) {
            let bestMatch = results.find((r: any) => r.syncedLyrics);
            if (!bestMatch) bestMatch = results.find((r: any) => r.plainLyrics);
            if (!bestMatch) bestMatch = results[0];

            if (bestMatch.plainLyrics || bestMatch.syncedLyrics) {
              return {
                plainLyrics: bestMatch.plainLyrics ?? null,
                syncedLyrics: bestMatch.syncedLyrics ?? null,
                source: "LRCLIB",
              } as LyricsResponse;
            }
          }
        }
      } catch (e) {
        console.warn("LRCLIB failed, falling back...");
      }

      // Strategy 2: Genius Scrape (Best for regional/extensive catalog)
      const geniusLyrics = await scrapeGenius(query);
      if (geniusLyrics) {
        return {
          plainLyrics: geniusLyrics,
          syncedLyrics: null,
          source: "Genius",
        } as LyricsResponse;
      }

      return null;
    } catch (e) {
      console.error("Failed to fetch lyrics:", e);
      return null;
    }
  });
