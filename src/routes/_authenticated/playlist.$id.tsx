import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, ArrowLeft, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPlaylistTracksFn, removeTrackFromPlaylistFn, reorderPlaylistFn, updatePlaylistNameFn, deletePlaylistFn, getPlaylistsFn, type Playlist, type PlaylistTrack } from "@/lib/playlists.functions";
import { usePlayer } from "@/lib/player-context";
import { LikeButton } from "@/components/LikeButton";

export const Route = createFileRoute("/_authenticated/playlist/$id")({
  component: PlaylistPage,
});

function PlaylistPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { play } = usePlayer();
  
  const getPlaylists = useServerFn(getPlaylistsFn);
  const getTracks = useServerFn(getPlaylistTracksFn);
  const removeTrack = useServerFn(removeTrackFromPlaylistFn);
  const reorder = useServerFn(reorderPlaylistFn);
  const deletePlaylist = useServerFn(deletePlaylistFn);
  const updateName = useServerFn(updatePlaylistNameFn);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    Promise.all([getPlaylists(), getTracks({ data: { playlist_id: id } })])
      .then(([ps, ts]) => {
        const p = ps.find(x => x.id === id);
        if (p) {
          setPlaylist(p);
          setEditName(p.name);
        } else {
          navigate({ to: "/library" });
        }
        setTracks(ts);
      })
      .finally(() => setLoading(false));
  }, [id, getPlaylists, getTracks, navigate]);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    play(tracks[0], tracks.slice(1));
  };

  const handleRemove = async (e: React.MouseEvent, ptId: string) => {
    e.stopPropagation();
    if (!confirm("Remove this track?")) return;
    setTracks(tracks.filter(t => t.playlist_track_id !== ptId));
    await removeTrack({ data: { playlist_track_id: ptId } });
  };

  const moveTrack = async (e: React.MouseEvent, index: number, direction: -1 | 1) => {
    e.stopPropagation();
    if (index + direction < 0 || index + direction >= tracks.length) return;
    
    const newTracks = [...tracks];
    const temp = newTracks[index];
    newTracks[index] = newTracks[index + direction];
    newTracks[index + direction] = temp;
    
    // Update positions
    newTracks.forEach((t, i) => t.position = i);
    setTracks(newTracks);
    
    // Sync to server
    await reorder({
      data: {
        playlist_id: id,
        updates: newTracks.map(t => ({ id: t.playlist_track_id, position: t.position }))
      }
    });
  };

  const handleRename = async () => {
    if (!editName.trim() || editName === playlist?.name) {
      setIsEditingName(false);
      return;
    }
    await updateName({ data: { id, name: editName } });
    if (playlist) setPlaylist({ ...playlist, name: editName });
    setIsEditingName(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this playlist?")) return;
    await deletePlaylist({ data: { id } });
    navigate({ to: "/library" });
  };

  if (loading) return <div className="p-8 text-muted-foreground text-center">Loading...</div>;
  if (!playlist) return null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8">
      <button onClick={() => window.history.back()} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-8">
        <div className="w-40 h-40 md:w-56 md:h-56 bg-secondary rounded-lg shadow-xl flex items-center justify-center overflow-hidden shrink-0">
          {tracks.length > 0 && tracks[0].thumbnail ? (
            <img src={tracks[0].thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
          ) : (
            <Play size={48} className="text-muted-foreground/30" />
          )}
        </div>
        
        <div className="flex-1 min-w-0 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest">Playlist</div>
          {isEditingName ? (
            <input 
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => e.key === "Enter" && handleRename()}
              className="text-3xl md:text-5xl font-black bg-transparent border-b-2 border-primary outline-none focus:ring-0 w-full"
            />
          ) : (
            <h1 onClick={() => setIsEditingName(true)} className="text-3xl md:text-5xl font-black truncate cursor-pointer hover:underline" title="Click to rename">
              {playlist.name}
            </h1>
          )}
          <div className="text-sm text-muted-foreground flex items-center gap-4">
            <span>{tracks.length} tracks</span>
            <button onClick={handleDelete} className="text-destructive hover:underline text-xs flex items-center gap-1">
              <Trash2 size={12} /> Delete Playlist
            </button>
          </div>
        </div>
      </div>

      {tracks.length > 0 && (
        <div className="mb-6">
          <button onClick={handlePlayAll} className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg">
            <Play size={24} fill="currentColor" className="ml-1" />
          </button>
        </div>
      )}

      {tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">This playlist is empty. Add songs from search or suggestions.</p>
      ) : (
        <ul className="divide-y divide-border bg-card rounded-lg overflow-hidden">
          {tracks.map((t, i) => (
            <li key={t.playlist_track_id} onClick={() => play(t, tracks.slice(i + 1))} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer group">
              <div className="w-8 flex flex-col items-center justify-center gap-1 opacity-20 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                <button onClick={e => moveTrack(e, i, -1)} disabled={i === 0} className="hover:text-primary disabled:opacity-0"><ChevronUp size={16} /></button>
                <button onClick={e => moveTrack(e, i, 1)} disabled={i === tracks.length - 1} className="hover:text-primary disabled:opacity-0"><ChevronDown size={16} /></button>
              </div>
              <img src={t.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{t.author}</div>
              </div>
              <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                <LikeButton track={t} />
                <button onClick={e => handleRemove(e, t.playlist_track_id)} className="p-2 text-muted-foreground hover:text-destructive transition opacity-0 group-hover:opacity-100">
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
