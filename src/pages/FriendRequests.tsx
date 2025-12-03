// src/pages/FriendRequests.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

type FriendRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
};

type DecoratedRow = FriendRow & {
  profile?: { id: string; username: string | null; avatar_url?: string | null };
};

const FriendRequests = () => {
  const [user, setUser] = useState<User | null>(null);
  const [incoming, setIncoming] = useState<DecoratedRow[]>([]);
  const [outgoing, setOutgoing] = useState<DecoratedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // auth + initial load
  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        navigate("/auth");
        return;
      }
      setUser(data.session.user);
      await loadRequests(data.session.user.id);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const loadRequests = async (uid: string) => {
    try {
      // incoming
      const { data: inc, error: incErr } = await supabase
        .from("friends")
        .select("*")
        .eq("friend_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (incErr) throw incErr;

      // outgoing
      const { data: out, error: outErr } = await supabase
        .from("friends")
        .select("*")
        .eq("user_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (outErr) throw outErr;

      const incomingRows = (inc || []) as FriendRow[];
      const outgoingRows = (out || []) as FriendRow[];

      const ids = Array.from(
        new Set([
          ...incomingRows.map((r) => r.user_id),
          ...outgoingRows.map((r) => r.friend_id),
        ])
      );

      let profileMap = new Map<
        string,
        { id: string; username: string | null; avatar_url?: string | null }
      >();

      if (ids.length > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ids);

        if (profErr) throw profErr;

        (profiles || []).forEach((p) => {
          profileMap.set(p.id, p);
        });
      }

      const decoratedIncoming: DecoratedRow[] = incomingRows.map((r) => ({
        ...r,
        profile: profileMap.get(r.user_id),
      }));

      const decoratedOutgoing: DecoratedRow[] = outgoingRows.map((r) => ({
        ...r,
        profile: profileMap.get(r.friend_id),
      }));

      setIncoming(decoratedIncoming);
      setOutgoing(decoratedOutgoing);
    } catch (err) {
      console.error("loadRequests error", err);
      toast.error("Failed to load friend requests");
    }
  };

  // realtime refresh
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`friends-reqs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `or(user_id.eq.${user.id},friend_id.eq.${user.id})`,
        },
        () => loadRequests(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const accept = async (req: DecoratedRow) => {
    if (!user) return;

    const { error: updateErr } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", req.id);

    if (updateErr) {
      console.error(updateErr);
      toast.error("Failed to accept");
      return;
    }

    // ensure reciprocal row
    const { data: existing } = await supabase
      .from("friends")
      .select("*")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${req.user_id}),and(user_id.eq.${req.user_id},friend_id.eq.${user.id})`
      );

    if (!existing || existing.length === 0) {
      const { error: insertErr } = await supabase
        .from("friends")
        .insert({
          user_id: user.id,
          friend_id: req.user_id,
          status: "accepted",
        });
      if (insertErr) {
        console.error(insertErr);
        toast.error("Failed to create reciprocal friend");
        return;
      }
    }

    toast.success("Friend request accepted");
    loadRequests(user.id);
  };

  const remove = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("friends").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Failed to remove");
      return;
    }
    toast.success("Removed");
    loadRequests(user.id);
  };

  if (loading || !user) {
    return <div className="p-6 text-white">Loading friend requests...</div>;
  }

  return (
    <SidebarProvider>
      <div className="relative min-h-screen flex bg-black text-white overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-[url('/cyberpunk-city.gif')]
          bg-cover bg-no-repeat opacity-30 blur-sm"
        />

        <ChatSidebar user={user} />

        <div className="flex-1 p-8 bg-gradient-to-br from-black/40 via-purple-900/20 to-cyan-800/10">
          <h1 className="text-3xl font-bold neon-text mb-6">
            Friend Requests
          </h1>

          <ScrollArea className="h-[78vh]">
            <div className="max-w-3xl space-y-10">
              {/* Incoming */}
              <section>
                <h2 className="text-xl font-semibold mb-3 neon-text">
                  Incoming
                </h2>
                {incoming.length === 0 ? (
                  <p className="opacity-70">No incoming requests.</p>
                ) : (
                  incoming.map((req) => (
                    <div
                      key={req.id}
                      className="glass-card p-4 rounded-xl flex items-center justify-between mb-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-cyan-400">
                          <AvatarFallback>
                            {(req.profile?.username?.[0] || "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {req.profile?.username || req.user_id}
                          </div>
                          <div className="text-xs opacity-70">
                            {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-500/40 hover:bg-green-500/70"
                          onClick={() => accept(req)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => remove(req.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </section>

              {/* Outgoing */}
              <section>
                <h2 className="text-xl font-semibold mb-3 neon-text">
                  Outgoing
                </h2>
                {outgoing.length === 0 ? (
                  <p className="opacity-70">No outgoing requests.</p>
                ) : (
                  outgoing.map((req) => (
                    <div
                      key={req.id}
                      className="glass-card p-4 rounded-xl flex items-center justify-between mb-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-purple-400">
                          <AvatarFallback>
                            {(req.profile?.username?.[0] || "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {req.profile?.username || req.friend_id}
                          </div>
                          <div className="text-xs opacity-70">
                            {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-400 text-red-300 hover:bg-red-500/20"
                        onClick={() => remove(req.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))
                )}
              </section>
            </div>
          </ScrollArea>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FriendRequests;
