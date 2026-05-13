export type { Track } from "./search.functions";
import { searchTracksFn, type Track } from "./search.functions";

export async function searchTracks(query: string): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  const results = await searchTracksFn({ data: { query: q } });
  if (!results.length) {
    throw new Error("No results found. Try a different query.");
  }
  return results;
}
