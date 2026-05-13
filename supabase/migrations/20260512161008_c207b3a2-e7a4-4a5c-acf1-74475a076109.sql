
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Liked tracks
CREATE TABLE public.liked_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  thumbnail TEXT,
  duration INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, track_id)
);
ALTER TABLE public.liked_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own likes" ON public.liked_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own likes" ON public.liked_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own likes" ON public.liked_tracks FOR DELETE USING (auth.uid() = user_id);

-- Listening history
CREATE TABLE public.listening_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  thumbnail TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own history" ON public.listening_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own history" ON public.listening_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX listening_history_user_played_idx ON public.listening_history (user_id, played_at DESC);
