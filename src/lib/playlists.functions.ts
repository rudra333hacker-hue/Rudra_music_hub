import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Track } from "./search";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Playlist = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type PlaylistTrack = Track & {
  playlist_track_id: string;
  playlist_id: string;
  position: number;
  added_at: string;
};

export const getPlaylistsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data as Playlist[];
  });

export const createPlaylistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => ({ name: String(data?.name ?? "My Playlist") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await supabase
      .from("playlists")
      .insert({ user_id: userId, name: data.name })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result as Playlist;
  });

export const deletePlaylistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => ({ id: String(data?.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getPlaylistTracksFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => ({ playlist_id: String(data?.playlist_id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tracks, error } = await supabase
      .from("playlist_tracks")
      .select("*")
      .eq("playlist_id", data.playlist_id)
      .eq("user_id", userId)
      .order("position", { ascending: true });

    if (error) throw new Error(error.message);
    return tracks.map((t) => ({
      id: t.track_id,
      title: t.title,
      author: t.author ?? "Unknown",
      thumbnail: t.thumbnail ?? "",
      duration: t.duration ?? 0,
      playlist_track_id: t.id,
      playlist_id: t.playlist_id,
      position: t.position,
      added_at: t.added_at,
    })) as PlaylistTrack[];
  });

export const addTrackToPlaylistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => ({
    playlist_id: String(data?.playlist_id),
    track: data?.track as Track,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Get max position
    const { data: posData } = await supabase
      .from("playlist_tracks")
      .select("position")
      .eq("playlist_id", data.playlist_id)
      .order("position", { ascending: false })
      .limit(1);
    
    const nextPos = posData && posData.length > 0 ? posData[0].position + 1 : 0;

    const { error } = await supabase
      .from("playlist_tracks")
      .insert({
        playlist_id: data.playlist_id,
        user_id: userId,
        track_id: data.track.id,
        title: data.track.title,
        author: data.track.author,
        thumbnail: data.track.thumbnail,
        duration: data.track.duration,
        position: nextPos,
      });

    if (error) {
      if (error.code === '23505') throw new Error("Track already in playlist");
      throw new Error(error.message);
    }
    return { success: true };
  });

export const removeTrackFromPlaylistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => ({
    playlist_track_id: String(data?.playlist_track_id),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("id", data.playlist_track_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updatePlaylistNameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => ({ id: String(data?.id), name: String(data?.name) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("playlists")
      .update({ name: data.name })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const reorderPlaylistFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => ({
    playlist_id: String(data?.playlist_id),
    updates: data?.updates as { id: string; position: number }[],
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Supabase JS doesn't support bulk update easily. We'll use supabaseAdmin to run rpc or loop.
    // For simplicity, we can do multiple updates since it's an admin operation or user-scoped operation.
    // However, updating via supabase client sequentially can be slow.
    // Since we only reorder the current page, max ~100 items, let's do Promise.all
    const promises = data.updates.map((update) =>
      supabaseAdmin
        .from("playlist_tracks")
        .update({ position: update.position })
        .eq("id", update.id)
        .eq("playlist_id", data.playlist_id)
        .eq("user_id", userId)
    );
    await Promise.all(promises);
    return { success: true };
  });
