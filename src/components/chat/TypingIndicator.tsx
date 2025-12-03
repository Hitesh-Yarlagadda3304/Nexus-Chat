// src/components/chat/TypingIndicator.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingIndicatorProps {
  channelId: string;
  currentUserId?: string;
}

interface TypingUser {
  id: string;
  name: string;
  last: number; // timestamp we last saw them typing
}

const TypingIndicator = ({ channelId, currentUserId }: TypingIndicatorProps) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    if (!channelId) return;

    // We listen on a lightweight realtime channel.
    // Even if nothing ever broadcasts, this will NOT crash.
    const channel = supabase
      .channel(`typing-${channelId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        // payload.payload can be literally anything; guard everything
        const data = (payload as any)?.payload || {};
        const userId: string | undefined = data.user_id;
        const username: string | undefined = data.username;

        if (!userId) return; // nothing to do
        if (userId === currentUserId) return; // don't show yourself

        const name = username || "Someone";
        const now = Date.now();

        setTypingUsers((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const existing = safePrev.find((u) => u.id === userId);

          if (existing) {
            return safePrev.map((u) =>
              u.id === userId ? { ...u, last: now } : u
            );
          }

          return [...safePrev, { id: userId, name, last: now }];
        });
      })
      .subscribe();

    // Periodically drop users that stopped typing
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter((u) => now - u.last < 4000); // 4s timeout
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [channelId, currentUserId]);

  // If no-one is typing, render nothing
  if (!Array.isArray(typingUsers) || typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.name).join(", ");

  return (
    <div className="mt-1 text-xs text-emerald-300 typing-glow">
      {names} {typingUsers.length === 1 ? "is typing…" : "are typing…"}
    </div>
  );
};

export default TypingIndicator;
