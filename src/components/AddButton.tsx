import { useState } from "react";
import { Plus } from "lucide-react";
import type { Track } from "@/lib/search";
import { AddToPlaylistModal } from "./AddToPlaylistModal";

export function AddButton({ track }: { track: Track }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        className="p-2 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition"
        title="Add to Playlist"
      >
        <Plus size={18} />
      </button>
      <AddToPlaylistModal track={track} isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
