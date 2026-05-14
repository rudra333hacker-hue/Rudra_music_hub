import { useEffect, useRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYTApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const existing = document.getElementById("yt-iframe-api-script");
    if (existing) {
      // Script already injected but callback not yet fired — wait for it
      const original = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        original?.();
        resolve();
      };
      return;
    }
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api-script";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return apiPromise;
}

type Props = {
  videoId: string | null;
  onEnded?: () => void;
  mode?: "audio" | "video";
  isPlaying?: boolean;
  seekRequest?: number | null;
  onTimeUpdate?: (time: number) => void;
  onDuration?: (duration: number) => void;
};

// A tiny silent WAV file encoded as base64 to keep the JS thread alive in the background
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export function YouTubePlayer({
  videoId,
  onEnded,
  mode = "audio",
  isPlaying = true,
  seekRequest = null,
  onTimeUpdate,
  onDuration,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationRef = useRef(onDuration);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs current without triggering effects
  onEndedRef.current = onEnded;
  onTimeUpdateRef.current = onTimeUpdate;
  onDurationRef.current = onDuration;

  // Init player once
  useEffect(() => {
    let cancelled = false;
    loadYTApi().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "240",
        width: "400",
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: mode === "video" ? 1 : 0,
        },
        events: {
          onStateChange: (e: any) => {
            // 0 = ended, 1 = playing, 2 = paused
            if (e.data === 0) {
              onEndedRef.current?.();
            }
            if (e.data === 1) {
              const p = playerRef.current;
              if (p && typeof p.getDuration === "function") {
                const dur = p.getDuration();
                if (dur > 0) onDurationRef.current?.(dur);
              }
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (progressInterval.current) clearInterval(progressInterval.current);
      try { playerRef.current?.destroy?.(); } catch {}
      playerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Sync videoId — reload when song changes
  useEffect(() => {
    if (!videoId) return;
    const tryLoad = () => {
      const p = playerRef.current;
      if (p && typeof p.loadVideoById === "function") {
        p.loadVideoById(videoId);
      } else {
        setTimeout(tryLoad, 200);
      }
    };
    tryLoad();
  }, [videoId]);

  // Sync play/pause state
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (isPlaying && typeof p.playVideo === "function") p.playVideo();
      else if (!isPlaying && typeof p.pauseVideo === "function") p.pauseVideo();
    } catch {}
  }, [isPlaying]);

  // Sync seek
  useEffect(() => {
    if (seekRequest === null) return;
    const p = playerRef.current;
    if (p && typeof p.seekTo === "function") {
      try { p.seekTo(seekRequest, true); } catch {}
    }
  }, [seekRequest]);

  // Progress tracking interval — only when playing
  useEffect(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    if (!isPlaying) return;
    progressInterval.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        if (typeof p.getCurrentTime === "function") {
          const t = p.getCurrentTime();
          if (t !== undefined) onTimeUpdateRef.current?.(t);
        }
        if (typeof p.getDuration === "function") {
          const d = p.getDuration();
          if (d > 0) onDurationRef.current?.(d);
        }
      } catch {}
    }, 1000);
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, [isPlaying]);

  // Audio-only quality optimisation
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (mode === "audio" && typeof p.setPlaybackQuality === "function") {
        p.setPlaybackQuality("tiny");
      }
    } catch {}
  }, [mode]);

  return (
    <>
      {/* Silent audio keeps background thread alive on mobile */}
      {isPlaying && (
        <audio
          src={SILENT_WAV}
          autoPlay
          loop
          muted={false}
          className="hidden pointer-events-none"
        />
      )}
      <div
        className={
          mode === "video"
            ? "w-full max-w-md aspect-video"
            : "w-px h-px overflow-hidden opacity-0 pointer-events-none absolute"
        }
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </>
  );
}
