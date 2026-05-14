import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-middleware";
import { z } from "zod";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

type Suggestion = { title: string; artist: string; reason?: string };

async function callAI(systemPrompt: string, userPrompt: string): Promise<Suggestion[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("[Suggestions] GEMINI_API_KEY is not set");
    throw new Error("GEMINI_API_KEY not configured");
  }

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            songs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  artist: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["title", "artist"],
              },
            },
          },
          required: ["songs"],
        },
        temperature: 0.8,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[Suggestions] Gemini API error ${res.status}: ${body}`);
    if (res.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
    if (res.status === 401 || res.status === 403) throw new Error("Gemini API key is invalid or missing permissions.");
    throw new Error(`Gemini API error ${res.status}`);
  }

  const data = await res.json();
  try {
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => (typeof p?.text === "string" ? p.text : ""))
        .join("") ?? "";
    if (!text) return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed?.songs) ? parsed.songs.slice(0, 20) : [];
  } catch {
    return [];
  }
}

// Fallback: genre-based recommendations when Gemini is unavailable
function getFallbackSuggestions(
  history: { title: string; author: string | null }[],
  likes: { title: string; author: string | null }[],
  mode: string,
  mood?: string,
): Suggestion[] {
  // Curated fallback pools by vibe
  const pools: Record<string, Suggestion[]> = {
    chill: [
      { title: "Sunflower", artist: "Post Malone" },
      { title: "Blinding Lights", artist: "The Weeknd" },
      { title: "Levitating", artist: "Dua Lipa" },
      { title: "Watermelon Sugar", artist: "Harry Styles" },
      { title: "Stay", artist: "The Kid LAROI, Justin Bieber" },
      { title: "Peaches", artist: "Justin Bieber" },
      { title: "good 4 u", artist: "Olivia Rodrigo" },
      { title: "Kiss Me More", artist: "Doja Cat" },
      { title: "Mood", artist: "24kGoldn" },
      { title: "Butter", artist: "BTS" },
      { title: "Montero", artist: "Lil Nas X" },
      { title: "Save Your Tears", artist: "The Weeknd" },
    ],
    hiphop: [
      { title: "HUMBLE.", artist: "Kendrick Lamar" },
      { title: "Sicko Mode", artist: "Travis Scott" },
      { title: "God's Plan", artist: "Drake" },
      { title: "Rockstar", artist: "Post Malone" },
      { title: "Bad Guy", artist: "Billie Eilish" },
      { title: "Old Town Road", artist: "Lil Nas X" },
      { title: "Industry Baby", artist: "Lil Nas X" },
      { title: "Donda Chant", artist: "Kanye West" },
      { title: "Way 2 Sexy", artist: "Drake" },
      { title: "Essence", artist: "Wizkid" },
      { title: "Laugh Now Cry Later", artist: "Drake" },
      { title: "Wants and Needs", artist: "Drake" },
    ],
    bollywood: [
      { title: "Tum Hi Ho", artist: "Arijit Singh" },
      { title: "Kesariya", artist: "Arijit Singh" },
      { title: "Raataan Lambiyan", artist: "Jubin Nautiyal" },
      { title: "Apna Bana Le", artist: "Arijit Singh" },
      { title: "Chaleya", artist: "Arijit Singh" },
      { title: "Pasoori", artist: "Ali Sethi, Shae Gill" },
      { title: "Maan Meri Jaan", artist: "King" },
      { title: "Kahani Suno", artist: "Kaifi Khalil" },
      { title: "O Bedardeya", artist: "Arijit Singh" },
      { title: "Phir Aur Kya Chahiye", artist: "Arijit Singh" },
      { title: "Tere Vaaste", artist: "Varun Jain" },
      { title: "Agar Tum Saath Ho", artist: "Arijit Singh" },
    ],
    genz: [
      { title: "Anti-Hero", artist: "Taylor Swift" },
      { title: "As It Was", artist: "Harry Styles" },
      { title: "vampire", artist: "Olivia Rodrigo" },
      { title: "Flowers", artist: "Miley Cyrus" },
      { title: "Cruel Summer", artist: "Taylor Swift" },
      { title: "Snooze", artist: "SZA" },
      { title: "Kill Bill", artist: "SZA" },
      { title: "Calm Down", artist: "Rema, Selena Gomez" },
      { title: "Unholy", artist: "Sam Smith" },
      { title: "Cupid", artist: "FIFTY FIFTY" },
      { title: "Escapism", artist: "RAYE" },
      { title: "Creepin'", artist: "Metro Boomin, The Weeknd" },
    ],
  };

  // Determine which pool to use
  let pool: Suggestion[];
  if (mode === "genz") {
    pool = pools.genz;
  } else if (mood) {
    const m = mood.toLowerCase();
    if (m.includes("hindi") || m.includes("bollywood") || m.includes("indian")) {
      pool = pools.bollywood;
    } else if (m.includes("rap") || m.includes("hip") || m.includes("hype")) {
      pool = pools.hiphop;
    } else {
      pool = pools.chill;
    }
  } else {
    // Mix from all pools
    pool = [...pools.chill, ...pools.hiphop, ...pools.bollywood, ...pools.genz];
  }

  // Filter out songs the user already has in history/likes
  const seen = new Set([
    ...history.map((h) => h.title.toLowerCase()),
    ...likes.map((l) => l.title.toLowerCase()),
  ]);

  const filtered = pool.filter((s) => !seen.has(s.title.toLowerCase()));
  // Shuffle
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  return filtered.slice(0, 12);
}

export const getSuggestionsFn = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        mode: z.enum(["mix", "mood", "similar", "genz"]).default("mix"),
        mood: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: history }, { data: likes }] = await Promise.all([
      supabase
        .from("listening_history")
        .select("title,author")
        .order("played_at", { ascending: false })
        .limit(20),
      supabase.from("liked_tracks").select("title,author").limit(30),
    ]);

    const histArr = history ?? [];
    const likeArr = likes ?? [];

    const histStr = histArr.map((r) => `- ${r.title} — ${r.author ?? ""}`).join("\n") || "(none yet)";
    const likeStr = likeArr.map((r) => `- ${r.title} — ${r.author ?? ""}`).join("\n") || "(none yet)";

    let system = "You are a music recommendation engine. Return 12 real song suggestions (title + artist) the user is likely to enjoy. Avoid duplicates of what they've already heard. Mix genres tastefully.";
    let user = `User listening history (most recent first):\n${histStr}\n\nLiked songs:\n${likeStr}\n\nReturn 12 fresh recommendations.`;

    if (data.mode === "mood" && data.mood) {
      system = "You are a music DJ. Given a mood/vibe prompt, return 12 real songs that match. Use the user's taste below to bias picks.";
      user = `Mood: "${data.mood}"\n\nUser taste:\nLikes:\n${likeStr}\nHistory:\n${histStr}\n\nReturn 12 songs.`;
    } else if (data.mode === "similar") {
      system = "You are a music recommender. Suggest 12 songs sonically similar to the user's likes and recent plays.";
      user = `Likes:\n${likeStr}\nRecent:\n${histStr}\n\nReturn 12 similar songs.`;
    } else if (data.mode === "genz") {
      system =
        "You are a Spotify-style music curator for a Gen-Z vibe mix. Return exactly 12 REAL songs (title + artist). " +
        "Vibe: current, internet-core, late-night + hype, a bit edgy but not explicit-only. Mix pop/rap/alt/indie/electronic tastefully. " +
        "Avoid duplicates, avoid repeating the same artist more than once, and avoid songs already in the user's history/likes.";
      user =
        `User listening history (most recent first):\n${histStr}\n\nLiked songs:\n${likeStr}\n\n` +
        "Create a fresh 'Gen-Z Mix' of 12 songs. Return JSON only.";
    }

    // Try Gemini first, fallback to curated lists if it fails
    try {
      const aiResults = await callAI(system, user);
      if (aiResults.length > 0) return aiResults;
    } catch (e: any) {
      console.error("[Suggestions] AI failed, using fallback:", e.message);
    }

    // Fallback: return curated recommendations
    return getFallbackSuggestions(histArr, likeArr, data.mode, data.mood);
  });
