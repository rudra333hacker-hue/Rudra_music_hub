import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Track } from "@/lib/search";
import { recordPlay } from "@/lib/library";

type Mode = "audio" | "video";

type PlayerCtx = {
  current: Track | null;
  queue: Track[];
  mode: Mode;
  setMode: (m: Mode) => void;
  play: (track: Track, queue?: Track[]) => void;
  next: () => void;
  prev: () => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [mode, setMode] = useState<Mode>("audio");
  const historyRef = useRef<Track[]>([]);

  const play = useCallback((track: Track, q: Track[] = []) => {
    if (current) historyRef.current.push(current);
    setCurrent(track);
    setQueue(q);
    recordPlay(track).catch(() => {});
  }, [current]);

  const next = useCallback(() => {
    if (!queue.length) {
      setCurrent(null);
      return;
    }
    const [n, ...rest] = queue;
    if (current) historyRef.current.push(current);
    setCurrent(n);
    setQueue(rest);
    recordPlay(n).catch(() => {});
  }, [queue, current]);

  const prev = useCallback(() => {
    const last = historyRef.current.pop();
    if (!last) return;
    if (current) setQueue((q) => [current, ...q]);
    setCurrent(last);
  }, [current]);

  // Integrate with OS-level media controls (lock screen, earbuds, notification controls).
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!navigator.mediaSession) return;
    if (!current) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.author ?? "",
        album: "Rudra Music Hub",
        artwork: current.thumbnail
          ? [
              { src: current.thumbnail, sizes: "96x96", type: "image/jpeg" },
              { src: current.thumbnail, sizes: "256x256", type: "image/jpeg" },
              { src: current.thumbnail, sizes: "512x512", type: "image/jpeg" },
            ]
          : [],
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    } catch {
      // ignore
    }
  }, [current, next, prev]);

  return <Ctx.Provider value={{ current, queue, mode, setMode, play, next, prev }}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside PlayerProvider");
  return v;
}
