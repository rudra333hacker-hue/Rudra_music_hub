import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Track } from "./search";
import {
  getPlaylists,
  savePlaylist,
  deletePlaylist as dbDeletePlaylist,
  overwriteAllPlaylists,
  type Playlist,
} from "./playlists-idb";

type PlaylistCtx = {
  playlists: Playlist[];
  loading: boolean;
  createPlaylist: (name: string) => Promise<void>;
  addTrack: (playlistId: string, track: Track) => Promise<void>;
  removeTrack: (playlistId: string, trackId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  reorderPlaylist: (playlistId: string, newTracks: Track[]) => Promise<void>;
  exportPlaylists: () => void;
  importPlaylists: (jsonString: string) => Promise<boolean>;
};

const Ctx = createContext<PlaylistCtx | null>(null);

export function LocalPlaylistProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  // Load on mount
  useEffect(() => {
    getPlaylists()
      .then((data) => {
        setPlaylists(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const createPlaylist = useCallback(async (name: string) => {
    const p: Playlist = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      tracks: [],
    };
    await savePlaylist(p);
    setPlaylists((prev) => [p, ...prev]);
  }, []);

  const addTrack = useCallback(
    async (playlistId: string, track: Track) => {
      const p = playlists.find((p) => p.id === playlistId);
      if (!p) return;

      // Prevent duplicates
      if (p.tracks.some((t) => t.id === track.id)) throw new Error("Track already in playlist");

      const updated = { ...p, tracks: [...p.tracks, track] };
      await savePlaylist(updated);
      setPlaylists((prev) => prev.map((list) => (list.id === playlistId ? updated : list)));
    },
    [playlists],
  );

  const removeTrack = useCallback(
    async (playlistId: string, trackId: string) => {
      const p = playlists.find((p) => p.id === playlistId);
      if (!p) return;

      const updated = { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) };
      await savePlaylist(updated);
      setPlaylists((prev) => prev.map((list) => (list.id === playlistId ? updated : list)));
    },
    [playlists],
  );

  const deletePlaylist = useCallback(async (playlistId: string) => {
    await dbDeletePlaylist(playlistId);
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }, []);

  const reorderPlaylist = useCallback(
    async (playlistId: string, newTracks: Track[]) => {
      const p = playlists.find((p) => p.id === playlistId);
      if (!p) return;

      const updated = { ...p, tracks: newTracks };
      await savePlaylist(updated);
      setPlaylists((prev) => prev.map((list) => (list.id === playlistId ? updated : list)));
    },
    [playlists],
  );

  const exportPlaylists = useCallback(() => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playlists, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "rudra_backup.json");
    dlAnchorElem.click();
  }, [playlists]);

  const importPlaylists = useCallback(async (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data)) throw new Error("Invalid format");

      // Basic schema validation
      const valid = data.filter((p) => p.id && p.name && Array.isArray(p.tracks));

      await overwriteAllPlaylists(valid);
      setPlaylists(valid.sort((a, b) => b.createdAt - a.createdAt));
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        playlists,
        loading,
        createPlaylist,
        addTrack,
        removeTrack,
        deletePlaylist,
        reorderPlaylist,
        exportPlaylists,
        importPlaylists,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePlaylists() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlaylists must be used within LocalPlaylistProvider");
  return v;
}
