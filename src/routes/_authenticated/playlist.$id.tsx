import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, ArrowLeft, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { usePlaylists } from "@/lib/playlist-context";
import { usePlayer } from "@/lib/player-context";
import { LikeButton } from "@/components/LikeButton";
import type { Playlist } from "@/lib/playlists-idb";

export const Route = createFileRoute("/_authenticated/playlist/$id")({
  component: PlaylistPage,
});

function PlaylistPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { play } = usePlayer();
  
  const { playlists, removeTrack, reorderPlaylist, deletePlaylist: rmPlaylist } = usePlaylists();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const p = playlists.find(x => x.id === id);
    if (p) {
      setPlaylist(p);
      setEditName(p.name);
    }
  }, [id, playlists]);

  const handlePlayAll = () => {
    if (!playlist || playlist.tracks.length === 0) return;
    play(playlist.tracks[0], playlist.tracks.slice(1));
  };

  const handleRemove = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    if (!confirm("Remove this track?")) return;
    await removeTrack(id, trackId);
  };

  const moveTrack = async (e: React.MouseEvent, index: number, direction: -1 | 1) => {
    e.stopPropagation();
    if (!playlist) return;
    if (index + direction < 0 || index + direction >= playlist.tracks.length) return;
    
    const newTracks = [...playlist.tracks];
    const temp = newTracks[index];
    newTracks[index] = newTracks[index + direction];
    newTracks[index + direction] = temp;
    
    await reorderPlaylist(id, newTracks);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this playlist?")) return;
    await rmPlaylist(id);
    navigate({ to: "/library" });
  };

  if (!playlist) return <div className="p-8 text-muted-foreground text-center">Playlist not found...</div>;

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8">
      <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-8">
        <div className="w-40 h-40 md:w-56 md:h-56 bg-secondary rounded-lg shadow-xl flex items-center justify-center overflow-hidden shrink-0">
          {playlist.tracks.length > 0 && playlist.tracks[0].thumbnail ? (
            <img src={playlist.tracks[0].thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
          ) : (
            <Play size={48} className="text-muted-foreground/30" />
          )}
        </div>
        
        <div className="flex-1 min-w-0 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest">Playlist</div>
          <h1 className="text-3xl md:text-5xl font-black truncate">
            {playlist.name}
          </h1>
          <div className="text-sm text-muted-foreground flex items-center gap-4">
            <span>{playlist.tracks.length} tracks</span>
            <button onClick={handleDelete} className="text-destructive hover:underline text-xs flex items-center gap-1">
              <Trash2 size={12} /> Delete Playlist
            </button>
          </div>
        </div>
      </div>

      {playlist.tracks.length > 0 && (
        <div className="mb-6">
          <button onClick={handlePlayAll} className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg">
            <Play size={24} fill="currentColor" className="ml-1" />
          </button>
        </div>
      )}

      {playlist.tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">This playlist is empty. Add songs from search or suggestions.</p>
      ) : (
        <ul className="divide-y divide-border bg-card rounded-lg overflow-hidden">
          {playlist.tracks.map((t, i) => (
            <li key={t.id + "_" + i} onClick={() => play(t, playlist.tracks.slice(i + 1))} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer group">
              <div className="w-8 flex flex-col items-center justify-center gap-1 opacity-20 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                <button onClick={e => moveTrack(e, i, -1)} disabled={i === 0} className="hover:text-primary disabled:opacity-0"><ChevronUp size={16} /></button>
                <button onClick={e => moveTrack(e, i, 1)} disabled={i === playlist.tracks.length - 1} className="hover:text-primary disabled:opacity-0"><ChevronDown size={16} /></button>
              </div>
              <img src={t.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{t.author}</div>
              </div>
              <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                <LikeButton track={t} />
                <button onClick={e => handleRemove(e, t.id)} className="p-2 text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
