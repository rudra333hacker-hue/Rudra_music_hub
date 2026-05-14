import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Track } from "@/lib/search";
import { recordPlay } from "@/lib/library";

type Mode = "audio" | "video";
type RepeatMode = "off" | "all" | "one";

type PlayerCtx = {
  current: Track | null;
  queue: Track[];
  mode: Mode;
  setMode: (m: Mode) => void;
  play: (track: Track, queue?: Track[]) => void;
  next: () => void;
  prev: () => void;
  isPlaying: boolean;
  setIsPlaying: (b: boolean) => void;
  togglePlay: () => void;
  repeatMode: RepeatMode;
  setRepeatMode: (m: RepeatMode) => void;
  currentTime: number;
  setCurrentTime: (n: number) => void;
  duration: number;
  setDuration: (n: number) => void;
  seekRequest: number | null;
  seekTo: (n: number) => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [mode, setMode] = useState<Mode>("audio");
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekRequest, setSeekRequest] = useState<number | null>(null);
  const historyRef = useRef<Track[]>([]);

  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const seekTo = useCallback((n: number) => setSeekRequest(n), []);

  const play = useCallback((track: Track, q: Track[] = []) => {
    if (current) historyRef.current.push(current);
    setCurrent(track);
    setQueue(q);
    setIsPlaying(true);
    setCurrentTime(0);
    recordPlay(track).catch(() => {});
  }, [current]);

  const next = useCallback(() => {
    if (repeatMode === "one" && current) {
      setSeekRequest(0);
      setIsPlaying(true);
      return;
    }
    if (!queue.length) {
      if (repeatMode === "all" && historyRef.current.length > 0) {
        // loop back to first song in history
        const all = [...historyRef.current, current!];
        historyRef.current = [];
        setCurrent(all[0]);
        setQueue(all.slice(1));
        setIsPlaying(true);
        setCurrentTime(0);
        return;
      }
      setCurrent(null);
      setIsPlaying(false);
      return;
    }
    const [n, ...rest] = queue;
    if (current) historyRef.current.push(current);
    setCurrent(n);
    setQueue(rest);
    setIsPlaying(true);
    setCurrentTime(0);
    recordPlay(n).catch(() => {});
  }, [queue, current, repeatMode]);

  const prev = useCallback(() => {
    if (currentTime > 3) {
      setSeekRequest(0);
      return;
    }
    const last = historyRef.current.pop();
    if (!last) return;
    if (current) setQueue((q) => [current, ...q]);
    setCurrent(last);
    setIsPlaying(true);
    setCurrentTime(0);
  }, [current, currentTime]);

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

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
      navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (d.seekTime !== undefined) seekTo(d.seekTime);
      });
    } catch {
      // ignore
    }
  }, [current, isPlaying, next, prev, seekTo]);

  const value: PlayerCtx = {
    current, queue, mode, setMode, play, next, prev,
    isPlaying, setIsPlaying, togglePlay,
    repeatMode, setRepeatMode,
    currentTime, setCurrentTime, duration, setDuration,
    seekRequest, seekTo
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside PlayerProvider");
  return v;
}
