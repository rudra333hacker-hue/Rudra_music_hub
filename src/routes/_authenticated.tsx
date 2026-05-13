import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, Library, LogOut, Music2, SkipBack, SkipForward, Headphones, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PlayerProvider, usePlayer } from "@/lib/player-context";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { LikeButton } from "@/components/LikeButton";

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
    <PlayerProvider>
      <Shell user={user} signOut={signOut} />
    </PlayerProvider>
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

function NowPlayingBar() {
  const { current, mode, setMode, next, prev } = usePlayer();
  if (!current) return null;
  return (
    <div className="fixed bottom-12 md:bottom-0 inset-x-0 bg-card border-t border-border z-30">
      <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-3">
        <img src={current.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{current.title}</div>
          <div className="text-xs text-muted-foreground truncate">{current.author}</div>
        </div>
        <LikeButton track={current} />
        <div className="hidden sm:flex items-center gap-1 rounded-full border border-border p-0.5">
          <button onClick={() => setMode("audio")} aria-label="Audio" className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${mode === "audio" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Headphones size={14} /> Audio
          </button>
          <button onClick={() => setMode("video")} aria-label="Video" className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${mode === "video" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Video size={14} /> Video
          </button>
        </div>
        <button onClick={prev} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Previous"><SkipBack size={18} /></button>
        <button onClick={next} className="p-2 bg-primary text-primary-foreground rounded-full" aria-label="Next"><SkipForward size={18} /></button>
      </div>
      <div className={mode === "video" ? "max-w-md mx-auto px-3 pb-2" : ""}>
        <YouTubePlayer videoId={current.id} onEnded={next} mode={mode} />
      </div>
    </div>
  );
}
