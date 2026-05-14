-- Playlists table
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own playlists" ON public.playlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own playlists" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own playlists" ON public.playlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own playlists" ON public.playlists FOR DELETE USING (auth.uid() = user_id);

-- Playlist tracks table
CREATE TABLE public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  thumbnail TEXT,
  duration INT DEFAULT 0,
  position INT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, track_id)
);
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own playlist tracks" ON public.playlist_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own playlist tracks" ON public.playlist_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own playlist tracks" ON public.playlist_tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own playlist tracks" ON public.playlist_tracks FOR DELETE USING (auth.uid() = user_id);

-- Index for ordering
CREATE INDEX playlist_tracks_playlist_position_idx ON public.playlist_tracks (playlist_id, position);
