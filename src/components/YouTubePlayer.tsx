import { useEffect, useRef, useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAudioStreamFn } from "@/lib/stream.functions";

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
    if (document.getElementById("yt-iframe-api")) {
      const orig = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { orig?.(); resolve(); };
      return;
    }
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api";
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
  const ytPlayerRef = useRef<any>(null);
  const nativeAudioRef = useRef<HTMLAudioElement>(null);

  const getAudioStream = useServerFn(getAudioStreamFn);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationRef = useRef(onDuration);
  const videoIdRef = useRef(videoId);
  const modeRef = useRef(mode);
  const isPlayingRef = useRef(isPlaying);

  onEndedRef.current = onEnded;
  onTimeUpdateRef.current = onTimeUpdate;
  onDurationRef.current = onDuration;
  videoIdRef.current = videoId;
  modeRef.current = mode;
  isPlayingRef.current = isPlaying;

  // Track the last known time so we can sync when switching modes or recovering from a stream drop
  const lastTimeRef = useRef(0);
  const retryTimeoutRef = useRef<any>(null);

  // === CRITICAL: Generation counter to prevent stale stream fetches ===
  const fetchGenRef = useRef(0);

  // === 1. Fetch Native Audio URL when in Audio Mode ===
  const fetchNativeStream = useCallback(async (vId: string, resumeTime: number = 0) => {
    const gen = ++fetchGenRef.current;
    try {
      const res = await getAudioStream({ data: { videoId: vId } });
      // If a newer fetch was initiated, discard this stale result
      if (gen !== fetchGenRef.current) return;
      if (res?.url) {
        setAudioUrl(res.url);
      }
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      console.error("Failed to fetch audio stream:", e);
    }
  }, [getAudioStream]);

  // When videoId or mode changes, fetch new stream (or clear it)
  useEffect(() => {
    if (!videoId) {
      setAudioUrl(null);
      return;
    }
    // Reset time tracking for new track
    lastTimeRef.current = 0;
    if (mode === "audio") {
      // Clear old URL immediately so old audio stops
      setAudioUrl(null);
      fetchNativeStream(videoId, 0);
    }
  }, [videoId, mode, fetchNativeStream]);

  // === 2. Native Audio Player Lifecycle & Error Recovery ===
  useEffect(() => {
    const audio = nativeAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.currentTime > 0) {
        lastTimeRef.current = audio.currentTime;
      }
      onTimeUpdateRef.current?.(audio.currentTime);
    };
    
    const handleDuration = () => {
      if (audio.duration && audio.duration !== Infinity) {
        onDurationRef.current?.(audio.duration);
      }
    };
    
    const handleEnded = () => onEndedRef.current?.();

    // Auto-play once the new audio source has loaded enough data
    const handleCanPlay = () => {
      if (isPlayingRef.current && modeRef.current === "audio") {
        audio.play().catch(e => console.log("Autoplay blocked:", e));
      }
    };

    // Stream drop recovery logic
    const handleError = (e: Event) => {
      console.warn("Native audio error. Attempting recovery...", e);
      if (videoIdRef.current && modeRef.current === "audio" && isPlayingRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          fetchNativeStream(videoIdRef.current!, lastTimeRef.current);
        }, 2000);
      }
    };

    const handleStalled = () => {
      // Only retry if truly stuck (not just buffering)
      if (videoIdRef.current && modeRef.current === "audio" && isPlayingRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          // Check if still stalled after 5 seconds
          if (audio.readyState < 3 && isPlayingRef.current) {
            fetchNativeStream(videoIdRef.current!, lastTimeRef.current);
          }
        }, 5000);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);
    audio.addEventListener("stalled", handleStalled);

    return () => {
      clearTimeout(retryTimeoutRef.current);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("stalled", handleStalled);
    };
  }, [fetchNativeStream]);

  // === 3. YT IFrame Player Lifecycle ===
  const ytTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const startYtTimer = useCallback(() => {
    if (ytTimerRef.current) return;
    ytTimerRef.current = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || modeRef.current !== "video") return;
      try {
        if (typeof p.getCurrentTime === "function") {
          const t = p.getCurrentTime();
          if (typeof t === "number" && t > 0) {
            lastTimeRef.current = t;
            onTimeUpdateRef.current?.(t);
          }
        }
        if (typeof p.getDuration === "function") {
          const d = p.getDuration();
          if (typeof d === "number" && d > 0) onDurationRef.current?.(d);
        }
      } catch {}
    }, 500);
  }, []);

  const stopYtTimer = useCallback(() => {
    if (ytTimerRef.current) {
      clearInterval(ytTimerRef.current);
      ytTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadYTApi().then(() => {
      if (cancelled || !containerRef.current) return;
      ytPlayerRef.current = new window.YT.Player(containerRef.current, {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 0,
          disablekb: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (videoIdRef.current && modeRef.current === "video") {
              ytPlayerRef.current.loadVideoById(videoIdRef.current, lastTimeRef.current);
            }
          },
          onStateChange: (e: any) => {
            if (modeRef.current !== "video") return;
            if (e.data === 0) { // ENDED
              stopYtTimer();
              onEndedRef.current?.();
            } else if (e.data === 1) { // PLAYING
              startYtTimer();
              try {
                const dur = ytPlayerRef.current?.getDuration?.();
                if (dur > 0) onDurationRef.current?.(dur);
              } catch {}
            } else if (e.data === 2) { // PAUSED
              stopYtTimer();
            }
          },
          onError: (e: any) => {
            if (modeRef.current !== "video") return;
            if (e.data === 150 || e.data === 101) onEndedRef.current?.();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      stopYtTimer();
      try { ytPlayerRef.current?.destroy?.(); } catch {}
      ytPlayerRef.current = null;
    };
  }, [startYtTimer, stopYtTimer]);

  // === 4. Mode Switching (Sync Time between Native and YT) ===
  useEffect(() => {
    if (!videoId) return;
    
    const audio = nativeAudioRef.current;
    const yt = ytPlayerRef.current;

    if (mode === "audio") {
      // Switch TO Audio
      if (yt && typeof yt.pauseVideo === "function") {
        try { yt.pauseVideo(); } catch {}
      }
      stopYtTimer();
    } else {
      // Switch TO Video
      if (audio) {
        audio.pause();
      }
      if (yt && typeof yt.loadVideoById === "function") {
        try {
          yt.loadVideoById(videoId, lastTimeRef.current);
        } catch {}
      }
    }
  }, [mode, videoId, stopYtTimer]);

  // === 5. Sync Play/Pause ===
  useEffect(() => {
    if (mode === "audio") {
      const audio = nativeAudioRef.current;
      if (!audio) return;
      // Only try to play/pause if we have a source
      if (!audioUrl) return;
      if (isPlaying) {
        // The audio element auto-plays via the canplay handler when a new source loads.
        // This effect handles pause/resume toggling for an already-loaded source.
        if (audio.readyState >= 2) {
          audio.play().catch(e => console.log("Native audio play blocked:", e));
        }
      } else {
        audio.pause();
      }
    } else {
      const yt = ytPlayerRef.current;
      if (!yt) return;
      try {
        if (isPlaying) {
          if (typeof yt.playVideo === "function") yt.playVideo();
        } else {
          if (typeof yt.pauseVideo === "function") yt.pauseVideo();
        }
      } catch {}
    }
  }, [isPlaying, mode, audioUrl]); 

  // === 6. Sync Seek Requests ===
  useEffect(() => {
    if (seekRequest === null) return;
    lastTimeRef.current = seekRequest;
    
    if (mode === "audio") {
      const audio = nativeAudioRef.current;
      if (audio && audio.readyState >= 1) {
        audio.currentTime = seekRequest;
      }
    } else {
      const yt = ytPlayerRef.current;
      if (yt && typeof yt.seekTo === "function") {
        try { yt.seekTo(seekRequest, true); } catch {}
      }
    }
  }, [seekRequest, mode]);

  return (
    <>
      {/* 100% Native Authentic Background HTML5 Audio */}
      <audio
        ref={nativeAudioRef}
        src={mode === "audio" && audioUrl ? audioUrl : undefined}
        preload="auto"
        playsInline
        className="hidden pointer-events-none"
      />
      
      {/* YT IFrame Video Player */}
      <div
        className={
          mode === "video"
            ? "w-full aspect-video rounded-lg overflow-hidden bg-black"
            : "w-0 h-0 overflow-hidden opacity-0 pointer-events-none absolute"
        }
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </>
  );
}
