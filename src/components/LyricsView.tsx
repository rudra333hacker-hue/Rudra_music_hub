import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLyricsFn, type LyricsResponse } from "@/lib/lyrics.functions";
import type { Track } from "@/lib/search";

type Props = {
  track: Track;
  currentTime: number;
};

export function LyricsView({ track, currentTime }: Props) {
  const getLyrics = useServerFn(getLyricsFn);
  const [lyrics, setLyrics] = useState<LyricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setLyrics(null);

    getLyrics({ data: { title: track.title, artist: track.author, duration: track.duration } })
      .then((res) => {
        if (!active) return;
        if (res) {
          setLyrics(res);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [track.id, getLyrics]);

  // Parse synced lyrics
  const parsedSynced = lyrics?.syncedLyrics
    ? lyrics.syncedLyrics.split("\n").map(line => {
        const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
        if (!match) return null;
        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
        return { time, text: match[3].trim() };
      }).filter((l): l is {time: number, text: string} => l !== null && l.text.length > 0)
    : null;

  // Auto-scroll synced lyrics
  useEffect(() => {
    if (!parsedSynced || !scrollRef.current) return;
    
    // Find active line
    const activeIndex = parsedSynced.findLastIndex(l => currentTime >= l.time - 0.5);
    if (activeIndex >= 0) {
      const el = scrollRef.current.children[activeIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentTime, parsedSynced]);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">Searching for lyrics...</div>;
  }

  if (error || !lyrics) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">No lyrics found for this song.</div>;
  }

  if (parsedSynced) {
    return (
      <div className="h-full overflow-y-auto pb-24 pt-12 space-y-6 px-4 no-scrollbar scroll-smooth" ref={scrollRef}>
        {parsedSynced.map((line, i) => {
          const isActive = currentTime >= line.time - 0.5 && (i === parsedSynced.length - 1 || currentTime < parsedSynced[i + 1].time - 0.5);
          return (
            <p 
              key={i} 
              className={`text-2xl sm:text-3xl font-bold transition-all duration-300 ${isActive ? 'text-primary scale-105 origin-left' : 'text-muted-foreground/40 hover:text-muted-foreground/60'}`}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto whitespace-pre-wrap text-xl sm:text-2xl font-bold text-foreground/80 leading-relaxed pb-24 pt-4 px-4 text-center">
      {lyrics.plainLyrics}
    </div>
  );
}
