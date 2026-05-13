import { supabase } from "@/integrations/supabase/client";
import type { Track } from "./search";

export async function recordPlay(t: Track) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("listening_history").insert({
    user_id: user.id,
    track_id: t.id,
    title: t.title,
    author: t.author,
    thumbnail: t.thumbnail,
  });
}

export async function toggleLike(t: Track, liked: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (liked) {
    await supabase.from("liked_tracks").delete().eq("user_id", user.id).eq("track_id", t.id);
  } else {
    await supabase.from("liked_tracks").insert({
      user_id: user.id,
      track_id: t.id,
      title: t.title,
      author: t.author,
      thumbnail: t.thumbnail,
      duration: t.duration,
    });
  }
}

export async function fetchLikes(): Promise<Track[]> {
  const { data, error } = await supabase
    .from("liked_tracks")
    .select("track_id,title,author,thumbnail,duration")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.track_id,
    title: r.title,
    author: r.author ?? "",
    thumbnail: r.thumbnail ?? `https://i.ytimg.com/vi/${r.track_id}/hqdefault.jpg`,
    duration: r.duration ?? 0,
  }));
}

export async function fetchHistory(limit = 30): Promise<Track[]> {
  const { data, error } = await supabase
    .from("listening_history")
    .select("track_id,title,author,thumbnail")
    .order("played_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const r of data) {
    if (seen.has(r.track_id)) continue;
    seen.add(r.track_id);
    out.push({
      id: r.track_id,
      title: r.title,
      author: r.author ?? "",
      thumbnail: r.thumbnail ?? `https://i.ytimg.com/vi/${r.track_id}/hqdefault.jpg`,
      duration: 0,
    });
  }
  return out;
}
