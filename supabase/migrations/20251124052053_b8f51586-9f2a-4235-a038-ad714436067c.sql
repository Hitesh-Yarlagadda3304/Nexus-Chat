-- Add message reactions table
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON public.message_reactions
  FOR SELECT
  USING (true);

CREATE POLICY "Users can add reactions"
  ON public.message_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add pinned messages tracking
ALTER TABLE public.messages ADD COLUMN is_pinned boolean DEFAULT false;

-- Add typing indicator tracking (we'll use realtime presence for this)
CREATE TABLE public.typing_indicators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view typing indicators"
  ON public.typing_indicators
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own typing indicator"
  ON public.typing_indicators
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;