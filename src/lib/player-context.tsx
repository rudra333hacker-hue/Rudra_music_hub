import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

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
  const silentRef = useRef<HTMLAudioElement>(null);

  // Keep refs to avoid stale closures in callbacks
  const currentRef = useRef<Track | null>(null);
  currentRef.current = current;
  const queueRef = useRef<Track[]>([]);
  queueRef.current = queue;
  const repeatModeRef = useRef<RepeatMode>("off");
  repeatModeRef.current = repeatMode;

  // Synchronously play silent audio to unlock background JS thread on iOS
  const unlockAudio = useCallback(() => {
    if (silentRef.current) {
      silentRef.current.play().catch(() => {});
    }
  }, []);

  const pauseUnlock = useCallback(() => {
    if (silentRef.current) {
      silentRef.current.pause();
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => {
      const nextState = !p;
      if (nextState) unlockAudio();
      else pauseUnlock();
      return nextState;
    });
  }, [unlockAudio, pauseUnlock]);

  const seekTo = useCallback((n: number) => setSeekRequest(n), []);

  const play = useCallback(
    (track: Track, q: Track[] = []) => {
      unlockAudio();
      // Use the ref to get the current track (avoids stale closure)
      const prev = currentRef.current;
      if (prev) historyRef.current.push(prev);

      // Reset playback state for new track
      setCurrentTime(0);
      setDuration(0);
      setSeekRequest(null);

      setCurrent(track);
      setQueue(q);
      setIsPlaying(true);
      recordPlay(track).catch(() => {});
    },
    [unlockAudio],
  );

  const next = useCallback(() => {
    unlockAudio();
    const cur = currentRef.current;
    const currentQueue = queueRef.current;
    const currentRepeatMode = repeatModeRef.current;
    if (currentRepeatMode === "one" && cur) {
      setSeekRequest(0);
      setIsPlaying(true);
      return;
    }
    if (!currentQueue.length) {
      if (currentRepeatMode === "all" && historyRef.current.length > 0) {
        // loop back to first song in history
        const all = [...historyRef.current, cur!];
        historyRef.current = [];
        setCurrent(all[0]);
        setQueue(all.slice(1));
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(0);
        return;
      }
      setCurrent(null);
      setIsPlaying(false);
      pauseUnlock();
      return;
    }
    const [n, ...rest] = currentQueue;
    if (cur) historyRef.current.push(cur);
    setCurrent(n);
    setQueue(rest);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    recordPlay(n).catch(() => {});
  }, [unlockAudio, pauseUnlock]);

  const prev = useCallback(() => {
    unlockAudio();
    if (currentTime > 3) {
      setSeekRequest(0);
      return;
    }
    const last = historyRef.current.pop();
    if (!last) return;
    const cur = currentRef.current;
    if (cur) setQueue((q) => [cur, ...q]);
    setCurrent(last);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
  }, [currentTime, unlockAudio]);

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
      // Media session actions should ALSO trigger the audio unlock
      navigator.mediaSession.setActionHandler("play", () => {
        unlockAudio();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        pauseUnlock();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (d.seekTime !== undefined) seekTo(d.seekTime);
      });
    } catch {
      // ignore
    }
  }, [current, isPlaying, next, prev, seekTo, unlockAudio, pauseUnlock]);

  const value: PlayerCtx = {
    current,
    queue,
    mode,
    setMode,
    play,
    next,
    prev,
    isPlaying,
    setIsPlaying,
    togglePlay,
    repeatMode,
    setRepeatMode,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    seekRequest,
    seekTo,
  };

  return (
    <Ctx.Provider value={value}>
      <audio
        ref={silentRef}
        src={SILENT_WAV}
        playsInline
        className="hidden pointer-events-none"
      />
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside PlayerProvider");
  return v;
}
