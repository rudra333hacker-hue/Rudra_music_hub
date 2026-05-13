import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toggleLike } from "@/lib/library";
import type { Track } from "@/lib/search";

export function LikeButton({ track, size = 18 }: { track: Track; size?: number }) {
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("liked_tracks")
      .select("track_id")
      .eq("track_id", track.id)
      .maybeSingle()
      .then(({ data }) => active && setLiked(!!data));
    return () => {
      active = false;
    };
  }, [track.id]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        const next = !liked;
        setLiked(next);
        toggleLike(track, liked).catch(() => setLiked(liked));
      }}
      aria-label={liked ? "Unlike" : "Like"}
      className="text-muted-foreground hover:text-primary transition"
    >
      <Heart size={size} fill={liked ? "currentColor" : "none"} className={liked ? "text-primary" : ""} />
    </button>
  );
}
