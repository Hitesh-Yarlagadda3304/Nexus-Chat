-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  status TEXT DEFAULT 'online',
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create channels table
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  reply_to UUID REFERENCES public.messages(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create friends table
CREATE TABLE public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Create direct_messages table
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Channels policies
CREATE POLICY "Channels are viewable by everyone"
  ON public.channels FOR SELECT
  USING (true);

-- Messages policies
CREATE POLICY "Messages are viewable by everyone"
  ON public.messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = user_id);

-- Friends policies
CREATE POLICY "Users can view their friends"
  ON public.friends FOR SELECT
  USING (
  auth.uid() = user_id
  OR auth.uid() = friend_id
);


CREATE POLICY "Users can send friend requests"
  ON public.friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friend requests"
  ON public.friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friendships"
  ON public.friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Direct messages policies
CREATE POLICY "Users can view their direct messages"
  ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own direct messages"
  ON public.direct_messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Create trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create default general channel
INSERT INTO public.channels (name, description, type)
VALUES ('general', 'General discussion channel', 'text');

-- Enable realtime for messages and direct_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true);

-- Storage policies for attachments
CREATE POLICY "Anyone can view attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own attachments"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);