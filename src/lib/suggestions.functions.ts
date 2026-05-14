import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/client-middleware";
import { z } from "zod";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

type Suggestion = { title: string; artist: string; reason?: string };

async function callAI(systemPrompt: string, userPrompt: string): Promise<Suggestion[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const schema = {
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
  } as const;

  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.8,
      },
    }),
  });
  if (!res.ok) {
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

    const histStr = (history ?? []).map((r) => `- ${r.title} — ${r.author ?? ""}`).join("\n") || "(none yet)";
    const likeStr = (likes ?? []).map((r) => `- ${r.title} — ${r.author ?? ""}`).join("\n") || "(none yet)";

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

    return callAI(system, user);
  });
