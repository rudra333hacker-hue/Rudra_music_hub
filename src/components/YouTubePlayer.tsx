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

  // === 1. Fetch Native Audio URL when in Audio Mode ===
  const fetchNativeStream = useCallback(async (vId: string, resumeTime: number = 0) => {
    try {
      const res = await getAudioStream({ data: { videoId: vId } });
      if (res?.url) {
        setAudioUrl(res.url);
        // If we were supposed to resume, seek to that time once loaded
        if (resumeTime > 0 && nativeAudioRef.current) {
          nativeAudioRef.current.currentTime = resumeTime;
        }
      }
    } catch (e) {
      console.error("Failed to fetch audio stream:", e);
    }
  }, [getAudioStream]);

  useEffect(() => {
    if (!videoId) {
      setAudioUrl(null);
      return;
    }
    if (mode === "audio") {
      fetchNativeStream(videoId, lastTimeRef.current);
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

    // Stream drop recovery logic
    const handleStreamDrop = (e: Event) => {
      console.warn("Native audio stream stalled or errored. Attempting recovery...", e.type);
      if (videoIdRef.current && modeRef.current === "audio" && isPlayingRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          // Re-fetch the stream and resume from exactly where it dropped
          fetchNativeStream(videoIdRef.current!, lastTimeRef.current);
        }, 1000);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleStreamDrop);
    audio.addEventListener("stalled", handleStreamDrop);

    return () => {
      clearTimeout(retryTimeoutRef.current);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleStreamDrop);
      audio.removeEventListener("stalled", handleStreamDrop);
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
          const currentUrl = yt.getVideoUrl?.() || "";
          if (currentUrl.includes(videoId)) {
            yt.seekTo(lastTimeRef.current, true);
            if (isPlaying) yt.playVideo();
          } else {
            yt.loadVideoById(videoId, lastTimeRef.current);
          }
        } catch {}
      }
    }
  }, [mode, videoId, isPlaying, stopYtTimer]);

  // === 5. Sync Play/Pause ===
  useEffect(() => {
    if (mode === "audio") {
      const audio = nativeAudioRef.current;
      if (!audio || !audio.src) return;
      if (isPlaying) {
        audio.play().catch(e => console.log("Native audio autoplay blocked:", e));
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
      if (audio) {
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
