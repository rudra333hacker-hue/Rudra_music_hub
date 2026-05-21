import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Search, Sparkles, Wand2, RefreshCw } from "lucide-react";
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
  const [mixProgress, setMixProgress] = useState("");

  const [mood, setMood] = useState("");

  // Track if a mix load was cancelled
  const mixGenRef = useRef(0);
  const lastMixReqRef = useRef<{
    mode: "mix" | "mood" | "similar" | "genz";
    moodText?: string;
  } | null>(null);

  useEffect(() => {
    fetchHistory(12).then(setRecent);
  }, []);

  async function loadMix(mode: "mix" | "mood" | "similar" | "genz", moodText?: string) {
    lastMixReqRef.current = { mode, moodText };
    const gen = ++mixGenRef.current;
    setMixLoading(true);
    setMixErr(null);
    setMixProgress("Getting AI suggestions...");
    setMix([]);
    try {
      const raw = await getSuggestions({ data: { mode, mood: moodText } });
      if (gen !== mixGenRef.current) return; // cancelled

      const suggestions = Array.isArray(raw) ? raw : [];
      if (!suggestions.length) {
        setMixErr("No suggestions returned. Try again.");
        return;
      }

      setMixProgress(`Resolving ${suggestions.length} tracks...`);

      // Resolve tracks in batches of 3 for better UX (shows partial results faster)
      const resolved: Track[] = [];
      const batchSize = 3;

      for (let i = 0; i < suggestions.length && i < 12; i += batchSize) {
        if (gen !== mixGenRef.current) return; // cancelled

        const batch = suggestions.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (s) => {
            const r = await searchTracks(`${s.title} ${s.artist}`);
            return r[0] ?? null;
          }),
        );

        for (const result of batchResults) {
          if (result.status === "fulfilled" && result.value) {
            resolved.push(result.value);
          }
        }

        // Show partial results progressively
        if (gen === mixGenRef.current) {
          setMix([...resolved]);
          setMixProgress(
            `Resolved ${resolved.length} of ${Math.min(suggestions.length, 12)} tracks...`,
          );
        }
      }

      if (gen !== mixGenRef.current) return;

      if (resolved.length === 0) {
        setMixErr("Could not find any of the suggested tracks. Please try again.");
      }
    } catch (e: any) {
      if (gen !== mixGenRef.current) return;
      setMixErr(e.message ?? "Could not load suggestions");
    } finally {
      if (gen === mixGenRef.current) {
        setMixLoading(false);
        setMixProgress("");
      }
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
    <div
      className="px-4 sm:px-6 lg:px-8 pt-6 pb-8 space-y-10 max-w-full overflow-x-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Search */}
      <section>
        <form onSubmit={onSearch} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs, artists…"
              className="w-full bg-card/80 backdrop-blur rounded-full pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || searching}
            className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            <Search size={16} />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
        {searchErr && <p className="text-sm text-destructive mt-2">{searchErr}</p>}
        {searching && <p className="text-sm text-muted-foreground mt-2">Searching…</p>}
        {results.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
        <div className="flex gap-2 max-w-xl w-full">
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="e.g. late-night focus, summer drive, sad acoustic…"
            className="flex-1 bg-card rounded-full px-4 py-2.5 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && mood.trim() && !mixLoading) {
                loadMix("mood", mood);
              }
            }}
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
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => loadMix("mix")}
              disabled={mixLoading}
              className="text-xs sm:text-sm bg-secondary px-3 py-1.5 rounded-full hover:bg-accent disabled:opacity-50"
            >
              Daily Mix
            </button>
            <button
              onClick={() => loadMix("similar")}
              disabled={mixLoading}
              className="text-xs sm:text-sm bg-secondary px-3 py-1.5 rounded-full hover:bg-accent disabled:opacity-50"
            >
              Similar
            </button>
            <button
              onClick={() => loadMix("genz")}
              disabled={mixLoading}
              className="text-xs sm:text-sm bg-secondary px-3 py-1.5 rounded-full hover:bg-accent disabled:opacity-50"
            >
              Gen-Z Mix
            </button>
          </div>
        </div>
        {mixErr && (
          <div className="flex items-center gap-3 mb-3">
            <p className="text-sm text-destructive">{mixErr}</p>
            <button
              onClick={() => {
                if (lastMixReqRef.current) {
                  loadMix(lastMixReqRef.current.mode, lastMixReqRef.current.moodText);
                }
              }}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
        {mixLoading && (
          <p className="text-sm text-muted-foreground">{mixProgress || "Curating with AI…"}</p>
        )}
        {mix.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
            {mix.map((t, i) => (
              <TrackCard key={t.id + i} t={t} onPlay={() => play(t, mix.slice(i + 1))} />
            ))}
          </div>
        )}
        {!mixLoading && mix.length === 0 && !mixErr && (
          <p className="text-sm text-muted-foreground">
            Tap "Daily Mix" to get personalized AI picks based on your listening.
          </p>
        )}
      </section>

      {/* Recently played */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">Recently played</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
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
    <div className="group relative min-w-0">
      <button
        onClick={onPlay}
        className="w-full text-left bg-card hover:bg-accent transition rounded-lg p-2 sm:p-3 flex flex-col gap-2"
      >
        <div className="relative aspect-square overflow-hidden rounded-md">
          <img
            src={t.thumbnail}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        </div>
        <div className="text-xs sm:text-sm font-medium line-clamp-2">{t.title}</div>
        <div className="text-[11px] sm:text-xs text-muted-foreground truncate">{t.author}</div>
      </button>
      <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex flex-col gap-1 z-10">
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition flex items-center justify-center bg-background/80 backdrop-blur rounded-full">
          <AddButton track={t} />
        </div>
      </div>
    </div>
  );
}

function TrackRow({ t, onPlay }: { t: Track; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      className="group flex items-center gap-2 sm:gap-3 p-2 rounded-md hover:bg-accent cursor-pointer min-w-0"
    >
      <img
        src={t.thumbnail}
        alt=""
        className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs sm:text-sm font-medium truncate">{t.title}</div>
        <div className="text-[11px] sm:text-xs text-muted-foreground truncate">{t.author}</div>
      </div>
      <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0 hidden sm:block">
        {fmt(t.duration)}
      </span>
      <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
        <AddButton track={t} />
        <LikeButton track={t} />
      </div>
    </div>
  );
}
