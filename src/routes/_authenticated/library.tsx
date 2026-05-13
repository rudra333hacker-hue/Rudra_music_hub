import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Clock } from "lucide-react";
import { fetchHistory, fetchLikes } from "@/lib/library";
import type { Track } from "@/lib/search";
import { usePlayer } from "@/lib/player-context";
import { LikeButton } from "@/components/LikeButton";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
  head: () => ({ meta: [{ title: "Your Library — Rudra Music Hub" }] }),
});

function LibraryPage() {
  const { play } = usePlayer();
  const [tab, setTab] = useState<"liked" | "history">("liked");
  const [liked, setLiked] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);

  useEffect(() => {
    if (tab === "liked") fetchLikes().then(setLiked);
    else fetchHistory(50).then(setHistory);
  }, [tab]);

  const list = tab === "liked" ? liked : history;

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Your Library</h1>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab("liked")} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm ${tab === "liked" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          <Heart size={14} /> Liked Songs
        </button>
        <button onClick={() => setTab("history")} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm ${tab === "history" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          <Clock size={14} /> Recently Played
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">{tab === "liked" ? "No liked songs yet. Tap the heart on any track." : "Nothing here yet — start playing some music."}</p>
      ) : (
        <ul className="divide-y divide-border bg-card rounded-lg overflow-hidden">
          {list.map((t, i) => (
            <li key={t.id + i} onClick={() => play(t, list.slice(i + 1))} className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer">
              <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
              <img src={t.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{t.author}</div>
              </div>
              <LikeButton track={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
