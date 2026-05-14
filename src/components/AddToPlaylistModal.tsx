import { useState, useEffect } from "react";
import { Plus, X, ListMusic, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPlaylistsFn, addTrackToPlaylistFn, type Playlist } from "@/lib/playlists.functions";
import type { Track } from "@/lib/search";

type Props = {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
};

export function AddToPlaylistModal({ track, isOpen, onClose }: Props) {
  const getPlaylists = useServerFn(getPlaylistsFn);
  const addTrack = useServerFn(addTrackToPlaylistFn);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getPlaylists()
        .then(setPlaylists)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setSuccessMsg("");
    }
  }, [isOpen, getPlaylists]);

  if (!isOpen) return null;

  const handleAdd = async (playlistId: string) => {
    setAddingTo(playlistId);
    try {
      await addTrack({ data: { playlist_id: playlistId, track } });
      setSuccessMsg("Added to playlist!");
      setTimeout(() => {
        setSuccessMsg("");
        onClose();
      }, 1500);
    } catch (e: any) {
      alert(e.message ?? "Failed to add track");
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold">Add to Playlist</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 flex items-center gap-3 bg-secondary/30">
          <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{track.title}</div>
            <div className="text-xs text-muted-foreground truncate">{track.author}</div>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="p-6 text-center">
              <ListMusic className="mx-auto mb-2 text-muted-foreground" size={32} />
              <p className="text-sm text-muted-foreground mb-4">You don't have any playlists yet.</p>
              <button onClick={onClose} className="text-xs text-primary font-medium hover:underline">
                Go to Library to create one
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {playlists.map(p => (
                <li key={p.id}>
                  <button 
                    onClick={() => handleAdd(p.id)}
                    disabled={addingTo !== null}
                    className="w-full flex items-center justify-between p-3 rounded-md hover:bg-accent text-left disabled:opacity-50 transition"
                  >
                    <span className="font-medium text-sm truncate pr-4">{p.name}</span>
                    {addingTo === p.id ? (
                      <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    ) : (
                      <Plus size={16} className="text-muted-foreground shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {successMsg && (
          <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-medium flex items-center justify-center gap-2">
            <Check size={16} /> {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}
