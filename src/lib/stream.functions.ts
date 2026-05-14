import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.r4fo.com",
  "https://pipedapi.leptons.xyz",
  "https://api.piped.private.coffee",
  "https://pipedapi.drgns.space",
  "https://pipedapi.ducks.party",
];

export const getAudioStreamFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { videoId: string };
    return { videoId: String(d?.videoId ?? "") };
  })
  .handler(async ({ data }) => {
    if (!data.videoId) throw new Error("No video ID provided");
    
    // Try each instance until one works
    for (const base of PIPED_INSTANCES) {
      try {
        const res = await fetch(`${base}/streams/${data.videoId}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const json = await res.json();
        
        // Find the best audio stream
        if (json && Array.isArray(json.audioStreams) && json.audioStreams.length > 0) {
          // Sort by bitrate descending to get best quality, prefer m4a/mp4 for iOS compatibility
          const streams = json.audioStreams.sort((a: any, b: any) => {
            const btrA = a.bitrate || 0;
            const btrB = b.bitrate || 0;
            return btrB - btrA;
          });
          
          // Try to find m4a first as it works universally in background on iOS
          let best = streams.find((s: any) => s.mimeType && s.mimeType.includes("mp4"));
          if (!best) best = streams[0];
          
          if (best && best.url) {
            return { url: best.url as string };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error("Could not extract audio stream");
  });
