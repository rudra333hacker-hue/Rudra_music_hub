import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home, Library, LogOut, SkipBack, SkipForward, Headphones, Video,
  Play, Pause, Repeat, Repeat1, ChevronDown
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PlayerProvider, usePlayer } from "@/lib/player-context";
import { LocalPlaylistProvider } from "@/lib/playlist-context";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { LikeButton } from "@/components/LikeButton";
import { AddButton } from "@/components/AddButton";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <LocalPlaylistProvider>
      <PlayerProvider>
        <Shell user={user} signOut={signOut} />
      </PlayerProvider>
    </LocalPlaylistProvider>
  );
}

function Shell({ user, signOut }: { user: any; signOut: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/", label: "Home", icon: Home },
    { to: "/library", label: "Library", icon: Library },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground p-4 gap-2">
          <div className="flex items-center gap-2 px-2 py-3">
            <img src="/logo.png" alt="Rudra Music Hub" className="w-6 h-6 object-contain" />
            <span className="font-bold text-lg truncate">Rudra Music Hub</span>
          </div>
          <nav className="flex flex-col gap-1 mt-2">
            {nav.map((n) => {
              const active = path === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                    active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  }`}
                >
                  <Icon size={18} /> {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-sidebar-border pt-3 px-2">
            <div className="text-xs text-sidebar-foreground/60 truncate mb-2">{user.email}</div>
            <button onClick={signOut} className="flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto pb-44 md:pb-32">
          <Outlet />
        </main>
      </div>

      {/* Now playing bar */}
      <NowPlayingBar />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-sidebar border-t border-sidebar-border flex z-40">
        {nav.map((n) => {
          const active = path === n.to;
          const Icon = n.icon;
          return (
            <Link key={n.to} to={n.to} className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs ${active ? "text-primary" : "text-sidebar-foreground/70"}`}>
              <Icon size={20} /> {n.label}
            </Link>
          );
        })}
        <button onClick={signOut} className="flex-1 flex flex-col items-center gap-1 py-2 text-xs text-sidebar-foreground/70">
          <LogOut size={20} /> Sign out
        </button>
      </nav>
    </div>
  );
}

/* ─── Helpers ─── */

function fmtTime(s: number) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/* ─── Now Playing Bar + Full-Screen Player ─── */

function NowPlayingBar() {
  const {
    current, mode, setMode, next, prev,
    isPlaying, togglePlay, repeatMode, setRepeatMode,
    currentTime, setCurrentTime, duration, setDuration,
    seekRequest, seekTo
  } = usePlayer();
  const [fullScreen, setFullScreen] = useState(false);

  if (!current) return null;

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* ── Single YouTube player ── always mounted ── */}
      <div className={mode === "video" && !fullScreen ? "fixed bottom-28 md:bottom-20 inset-x-0 flex justify-center z-30 px-4" : "sr-only"}>
        <div className="w-full max-w-md">
          <YouTubePlayer
            videoId={current.id}
            mode={mode}
            isPlaying={isPlaying}
            onEnded={next}
            seekRequest={seekRequest}
            onTimeUpdate={setCurrentTime}
            onDuration={setDuration}
          />
        </div>
      </div>

      {/* ── Mini bar ── */}
      <div className="fixed bottom-12 md:bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-border z-30">
        {/* Thin progress bar */}
        <div
          className="w-full h-1 bg-secondary cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo(((e.clientX - rect.left) / rect.width) * (duration || 0));
          }}
        >
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-2">
          {/* Thumbnail — opens full screen */}
          <img
            src={current.thumbnail}
            alt=""
            className="w-11 h-11 rounded object-cover cursor-pointer flex-shrink-0"
            onClick={() => setFullScreen(true)}
          />

          {/* Title — opens full screen */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setFullScreen(true)}>
            <div className="text-sm font-semibold truncate leading-tight">{current.title}</div>
            <div className="text-xs text-muted-foreground truncate">{current.author}</div>
          </div>

            {/* Controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Repeat */}
              <button
                onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")}
                className={`p-2 rounded-full transition hidden sm:block ${repeatMode !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>

              {/* Prev */}
              <button onClick={prev} className="p-2 text-muted-foreground hover:text-foreground hidden sm:block">
                <SkipBack size={18} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-9 h-9 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:scale-105 active:scale-95 transition mx-1"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Next */}
              <button onClick={next} className="p-2 text-muted-foreground hover:text-foreground">
                <SkipForward size={18} />
              </button>

              {/* Add & Like */}
              <div className="flex items-center ml-1">
                <AddButton track={current} />
                <LikeButton track={current} />
              </div>
            </div>
          </div>
      </div>

      {/* ── Full Screen Player Modal ── */}
      {fullScreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom-full duration-300">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setFullScreen(false)} className="p-2 text-muted-foreground hover:text-foreground">
              <ChevronDown size={28} />
            </button>
            <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Now Playing</div>
            <div className="w-10" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full gap-8">
            {/* Album art */}
            <div className="w-full aspect-square rounded-xl overflow-hidden shadow-2xl">
              <img src={current.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>

            {/* Song info */}
            <div className="w-full flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold truncate">{current.title}</h2>
                <p className="text-lg text-muted-foreground truncate">{current.author}</p>
              </div>
              <div className="flex items-center gap-2">
                <AddButton track={current} />
                <LikeButton track={current} />
              </div>
            </div>

            {/* Seek bar */}
            <div className="w-full space-y-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime || 0}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-medium tabular-nums">
                <span>{fmtTime(currentTime)}</span>
                <span>{fmtTime(duration)}</span>
              </div>
            </div>

            {/* Playback controls */}
            <div className="w-full flex items-center justify-between">
              <button
                onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")}
                className={`p-2 transition ${repeatMode !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {repeatMode === "one" ? <Repeat1 size={24} /> : <Repeat size={24} />}
              </button>

              <div className="flex items-center gap-6">
                <button onClick={prev} className="p-2 text-foreground hover:scale-105 transition">
                  <SkipBack size={32} fill="currentColor" />
                </button>
                <button onClick={togglePlay} className="p-4 bg-primary text-primary-foreground rounded-full hover:scale-105 transition shadow-lg">
                  {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                </button>
                <button onClick={next} className="p-2 text-foreground hover:scale-105 transition">
                  <SkipForward size={32} fill="currentColor" />
                </button>
              </div>

              <div className="w-10" />
            </div>

            {/* Audio/Video toggle */}
            <div className="flex items-center gap-1 rounded-full border border-border p-0.5 mt-4">
              <button onClick={() => setMode("audio")} className={`px-4 py-2 rounded-full text-sm flex items-center gap-2 ${mode === "audio" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <Headphones size={16} /> Audio
              </button>
              <button onClick={() => setMode("video")} className={`px-4 py-2 rounded-full text-sm flex items-center gap-2 ${mode === "video" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <Video size={16} /> Video
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
