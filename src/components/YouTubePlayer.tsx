import { useEffect, useRef } from "react";

// Minimal typing for YT IFrame API
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
    const tag = document.createElement("script");
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
};

export function YouTubePlayer({ videoId, onEnded, mode = "audio" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // init player once
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
          controls: 1,
        },
        events: {
          onStateChange: (e: any) => {
            // 0 = ended
            if (e.data === 0) onEndedRef.current?.();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
  }, []);

  // load videoId on change
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

  // Try to reduce bandwidth in audio mode by requesting the lowest playback quality.
  // Note: YouTube does not guarantee audio-only streams via the IFrame API.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (mode === "audio" && typeof p.setPlaybackQuality === "function") {
        p.setPlaybackQuality("tiny");
      }
    } catch {}
  }, [mode, videoId]);

  return (
    <div
      className={
        mode === "video"
          ? "w-full max-w-md aspect-video"
          : "w-px h-px overflow-hidden opacity-0 pointer-events-none absolute"
      }
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
