import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Clock, ListMusic, Plus } from "lucide-react";
import { fetchHistory, fetchLikes } from "@/lib/library";
import type { Track } from "@/lib/search";
import { usePlayer } from "@/lib/player-context";
import { LikeButton } from "@/components/LikeButton";
import { getPlaylistsFn, createPlaylistFn, type Playlist } from "@/lib/playlists.functions";
import { useServerFn } from "@tanstack/react-start";

import { AddButton } from "@/components/AddButton";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
  head: () => ({ meta: [{ title: "Your Library — Rudra Music Hub" }] }),
});

function LibraryPage() {
  const { play } = usePlayer();
  const getPlaylists = useServerFn(getPlaylistsFn);
  const createPlaylist = useServerFn(createPlaylistFn);

  const [tab, setTab] = useState<"liked" | "history" | "playlists">("playlists");
  const [liked, setLiked] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (tab === "liked") fetchLikes().then(setLiked);
    else if (tab === "history") fetchHistory(50).then(setHistory);
    else getPlaylists().then(setPlaylists).catch(() => {});
  }, [tab, getPlaylists]);

  const list = tab === "liked" ? liked : history;

  const handleCreate = async () => {
    const name = prompt("Enter playlist name:");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const p = await createPlaylist({ data: { name } });
      setPlaylists([p, ...playlists]);
    } catch (e) {
      alert("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Your Library</h1>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2 scrollbar-hide">
        <button onClick={() => setTab("playlists")} className={`flex whitespace-nowrap items-center gap-2 px-4 py-1.5 rounded-full text-sm ${tab === "playlists" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
          <ListMusic size={14} /> Playlists
        </button>
        <button onClick={() => setTab("liked")} className={`flex whitespace-nowrap items-center gap-2 px-4 py-1.5 rounded-full text-sm ${tab === "liked" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
          <Heart size={14} /> Liked Songs
        </button>
        <button onClick={() => setTab("history")} className={`flex whitespace-nowrap items-center gap-2 px-4 py-1.5 rounded-full text-sm ${tab === "history" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
          <Clock size={14} /> Recently Played
        </button>
      </div>

      {tab === "playlists" ? (
        <div className="space-y-4">
          <button 
            onClick={handleCreate} 
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground transition disabled:opacity-50"
          >
            <Plus size={20} /> {creating ? "Creating..." : "Create Playlist"}
          </button>
          {playlists.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">You haven't created any playlists yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {playlists.map(p => (
                <Link key={p.id} to="/playlist/$id" params={{ id: p.id }} className="block group">
                  <div className="aspect-square bg-secondary rounded-lg mb-2 flex items-center justify-center group-hover:bg-primary/20 transition">
                    <ListMusic className="text-muted-foreground group-hover:text-primary transition" size={40} />
                  </div>
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Playlist</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm">{tab === "liked" ? "No liked songs yet. Tap the heart on any track." : "Nothing here yet — start playing some music."}</p>
      ) : (
        <ul className="divide-y divide-border bg-card rounded-lg overflow-hidden">
          {list.map((t, i) => (
            <li key={t.id + i} onClick={() => play(t, list.slice(i + 1))} className="group flex items-center gap-3 p-3 hover:bg-accent cursor-pointer">
              <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
              <img src={t.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{t.author}</div>
              </div>
              <div className="flex items-center" onClick={e => e.stopPropagation()}>
                <AddButton track={t} />
                <LikeButton track={t} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
