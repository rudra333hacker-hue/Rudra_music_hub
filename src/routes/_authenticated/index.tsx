import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Sparkles, Wand2 } from "lucide-react";
import { searchTracks, type Track } from "@/lib/search";
import { fetchHistory } from "@/lib/library";
import { getSuggestionsFn } from "@/lib/suggestions.functions";
import { useServerFn } from "@tanstack/react-start";
import { usePlayer } from "@/lib/player-context";
import { LikeButton } from "@/components/LikeButton";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Home — Rudra Music Hub" }] }),
});

function fmt(s: number) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function HomePage() {
  const { play } = usePlayer();
  const getSuggestions = useServerFn(getSuggestionsFn);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  const [recent, setRecent] = useState<Track[]>([]);
  const [mix, setMix] = useState<Track[]>([]);
  const [mixLoading, setMixLoading] = useState(false);
  const [mixErr, setMixErr] = useState<string | null>(null);

  const [mood, setMood] = useState("");

  useEffect(() => {
    fetchHistory(12).then(setRecent);
  }, []);

  async function loadMix(mode: "mix" | "mood" | "similar" | "genz", moodText?: string) {
    setMixLoading(true);
    setMixErr(null);
    try {
      const raw = await getSuggestions({ data: { mode, mood: moodText } });
      const suggestions = Array.isArray(raw) ? raw : [];
      if (!suggestions.length) {
        setMixErr("No suggestions returned. Try again.");
        return;
      }
      // Resolve each to a real Track via search
      const resolved = await Promise.all(
        suggestions.slice(0, 12).map(async (s) => {
          try {
            const r = await searchTracks(`${s.title} ${s.artist}`);
            return r[0] ?? null;
          } catch {
            return null;
          }
        }),
      );
      setMix(resolved.filter((t): t is Track => !!t));
    } catch (e: any) {
      setMixErr(e.message ?? "Could not load suggestions");
    } finally {
      setMixLoading(false);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchErr(null);
    try {
      setResults(await searchTracks(query));
    } catch (e: any) {
      setSearchErr(e.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-8 space-y-10" style={{ background: "var(--gradient-hero)" }}>
      {/* Search */}
      <section>
        <form onSubmit={onSearch} className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists…"
            className="w-full bg-card/80 backdrop-blur rounded-full pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>
        {searchErr && <p className="text-sm text-destructive mt-2">{searchErr}</p>}
        {searching && <p className="text-sm text-muted-foreground mt-2">Searching…</p>}
        {results.length > 0 && (
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {results.slice(0, 12).map((t, i) => (
              <TrackRow key={t.id} t={t} onPlay={() => play(t, results.slice(i + 1))} />
            ))}
          </div>
        )}
      </section>

      {/* AI Mood */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="text-primary" size={20} />
          <h2 className="text-xl font-bold">AI Mood Mix</h2>
        </div>
        <div className="flex gap-2 max-w-xl">
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="e.g. late-night focus, summer drive, sad acoustic…"
            className="flex-1 bg-card rounded-full px-4 py-2.5 text-sm"
          />
          <button
            onClick={() => loadMix("mood", mood)}
            disabled={!mood.trim() || mixLoading}
            className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </section>

      {/* Daily Mix / Suggestions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            <h2 className="text-xl font-bold">Made for you</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadMix("mix")} className="text-xs sm:text-sm bg-secondary px-3 py-1.5 rounded-full hover:bg-accent">Daily Mix</button>
            <button onClick={() => loadMix("similar")} className="text-xs sm:text-sm bg-secondary px-3 py-1.5 rounded-full hover:bg-accent">Similar to your likes</button>
            <button onClick={() => loadMix("genz")} className="text-xs sm:text-sm bg-secondary px-3 py-1.5 rounded-full hover:bg-accent">Gen-Z Mix</button>
          </div>
        </div>
        {mixErr && <p className="text-sm text-destructive">{mixErr}</p>}
        {mixLoading && <p className="text-sm text-muted-foreground">Curating with AI…</p>}
        {mix.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mix.map((t, i) => (
              <TrackCard key={t.id + i} t={t} onPlay={() => play(t, mix.slice(i + 1))} />
            ))}
          </div>
        )}
        {!mixLoading && mix.length === 0 && (
          <p className="text-sm text-muted-foreground">Tap “Daily Mix” to get personalized AI picks based on your listening.</p>
        )}
      </section>

      {/* Recently played */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">Recently played</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {recent.map((t, i) => (
              <TrackCard key={t.id + i} t={t} onPlay={() => play(t, recent.slice(i + 1))} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import { AddButton } from "@/components/AddButton";

function TrackCard({ t, onPlay }: { t: Track; onPlay: () => void }) {
  return (
    <div className="group relative">
      <button onClick={onPlay} className="w-full text-left bg-card hover:bg-accent transition rounded-lg p-3 flex flex-col gap-2">
        <div className="relative aspect-square overflow-hidden rounded-md">
          <img src={t.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
        </div>
        <div className="text-sm font-medium line-clamp-2">{t.title}</div>
        <div className="text-xs text-muted-foreground truncate">{t.author}</div>
      </button>
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition flex items-center justify-center bg-background/80 backdrop-blur rounded-full">
          <AddButton track={t} />
        </div>
      </div>
    </div>
  );
}

function TrackRow({ t, onPlay }: { t: Track; onPlay: () => void }) {
  return (
    <div onClick={onPlay} className="group flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
      <img src={t.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{t.title}</div>
        <div className="text-xs text-muted-foreground truncate">{t.author}</div>
      </div>
      <span className="text-xs text-muted-foreground">{fmt(t.duration)}</span>
      <div className="flex items-center" onClick={e => e.stopPropagation()}>
        <AddButton track={t} />
        <LikeButton track={t} />
      </div>
    </div>
  );
}
