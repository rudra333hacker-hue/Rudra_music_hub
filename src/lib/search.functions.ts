import { createServerFn } from "@tanstack/react-start";

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.leptons.xyz",
  "https://api.piped.private.coffee",
  "https://pipedapi.drgns.space",
  "https://pipedapi.ducks.party",
];

export type Track = {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
};

type PipedItem = {
  url?: string;
  title?: string;
  uploaderName?: string;
  duration?: number;
  thumbnail?: string;
  type?: string;
};

function extractId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (m) return m[1];
  const q = url.match(/[?&]v=([\w-]{11})/);
  return q ? q[1] : null;
}

async function searchPiped(q: string): Promise<Track[] | null> {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(
        `${base}/search?q=${encodeURIComponent(q)}&filter=music_songs`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { items?: PipedItem[] };
      const items = data.items ?? [];
      const tracks: Track[] = [];
      for (const it of items) {
        if (it.type && it.type !== "stream") continue;
        const id = extractId(it.url);
        if (!id) continue;
        tracks.push({
          id,
          title: it.title ?? "Unknown",
          author: it.uploaderName ?? "Unknown",
          duration: it.duration ?? 0,
          thumbnail:
            it.thumbnail ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        });
      }
      if (tracks.length) return tracks;
    } catch {
      continue;
    }
  }
  return null;
}

// Fallback: scrape YouTube search results page (no key)
async function searchYouTubeScrape(q: string): Promise<Track[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(8000),
  });
  const html = await res.text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  let data: any;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const tracks: Track[] = [];
  const seen = new Set<string>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const id = v.videoId;
      if (id && !seen.has(id)) {
        seen.add(id);
        const title =
          v.title?.runs?.[0]?.text ?? v.title?.simpleText ?? "Unknown";
        const author =
          v.ownerText?.runs?.[0]?.text ??
          v.longBylineText?.runs?.[0]?.text ??
          "Unknown";
        const durText: string | undefined =
          v.lengthText?.simpleText ?? v.lengthText?.runs?.[0]?.text;
        let duration = 0;
        if (durText) {
          const parts = durText.split(":").map((n) => parseInt(n, 10));
          if (parts.every((n) => !isNaN(n))) {
            duration = parts.reduce((a, b) => a * 60 + b, 0);
          }
        }
        tracks.push({
          id,
          title,
          author,
          duration,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        });
      }
    }
    if (Array.isArray(node)) {
      for (const c of node) walk(c);
    } else {
      for (const k in node) walk(node[k]);
    }
  };
  walk(data);
  return tracks.slice(0, 30);
}

export const searchTracksFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { query?: string };
    return { query: String(d?.query ?? "").slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const q = data.query.trim();
    if (!q) return [] as Track[];
    const piped = await searchPiped(q);
    if (piped && piped.length) return piped;
    try {
      return await searchYouTubeScrape(q);
    } catch (e) {
      console.error("YouTube scrape failed", e);
      return [] as Track[];
    }
  });
