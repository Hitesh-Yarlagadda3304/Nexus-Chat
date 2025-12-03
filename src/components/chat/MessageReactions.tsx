import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import { toast } from "sonner";

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface MessageReactionsProps {
  messageId: string;
  userId: string | undefined;
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const MessageReactions = ({ messageId, userId }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    loadReactions();

    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        () => loadReactions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, userId]);

  const loadReactions = async () => {
    const { data } = await supabase
      .from("message_reactions")
      .select("emoji, user_id")
      .eq("message_id", messageId);

    if (!data) return;

    const reactionMap = new Map<string, Reaction>();
    data.forEach((r) => {
      const existing = reactionMap.get(r.emoji) || { emoji: r.emoji, count: 0, userReacted: false };
      existing.count++;
      if (r.user_id === userId) existing.userReacted = true;
      reactionMap.set(r.emoji, existing);
    });

    setReactions(Array.from(reactionMap.values()));
  };

  const toggleReaction = async (emoji: string) => {
    if (!userId) return;

    const existing = reactions.find((r) => r.emoji === emoji && r.userReacted);

    if (existing) {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", emoji);

      if (error) toast.error("Failed to remove reaction");
    } else {
      const { error } = await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: userId, emoji });

      if (error) toast.error("Failed to add reaction");
    }

    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant="ghost"
          size="sm"
          onClick={() => toggleReaction(reaction.emoji)}
          className={`h-6 px-2 text-xs ${
            reaction.userReacted ? "bg-primary/20 border border-primary" : "hover:bg-muted"
          }`}
        >
          {reaction.emoji} {reaction.count}
        </Button>
      ))}

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPicker(!showPicker)}
          className="h-6 w-6 p-0 hover:bg-muted"
        >
          <Smile className="h-3 w-3" />
        </Button>

        {showPicker && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-card border border-border rounded-lg shadow-lg flex gap-1 z-10">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                onClick={() => toggleReaction(emoji)}
                className="h-8 w-8 p-0 hover:bg-muted text-lg"
              >
                {emoji}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageReactions;
