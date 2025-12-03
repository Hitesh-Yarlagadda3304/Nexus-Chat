// src/pages/Friends.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type FriendRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
};

const FriendsPage = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [friendsRows, setFriendsRows] = useState<FriendRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const navigate = useNavigate();

  // 🔐 Load current auth user first
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error(error);
        toast.error("Failed to load session");
        return;
      }
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setCurrentUser(data.user);
    };

    loadUser();
  }, [navigate]);

  // 📥 Load profiles + friends when we know who we are
  useEffect(() => {
    if (!currentUser?.id) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([loadProfiles(currentUser.id), loadFriends(currentUser.id)]);
      setLoading(false);
    };
    load();
  }, [currentUser?.id]);

  // 🔹 Load all profiles except self
  const loadProfiles = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .neq("id", userId)
      .order("username", { ascending: true });

    if (error) {
      console.error("loadProfiles error", error);
      toast.error("Failed to load users");
      return;
    }
    setAllUsers(data || []);
  };

  // 🔹 Load friend rows involving me
  const loadFriends = async (userId: string) => {
    const { data, error } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, status")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) {
      console.error("loadFriends error", error);
      toast.error("Failed to load friends");
      return;
    }
    setFriendsRows(data || []);
  };

  // Utility: find friendship row between me + other
  const getFriendship = (otherId: string) => {
    if (!currentUser) return null;
    return (
      friendsRows.find(
        (f) =>
          (f.user_id === currentUser.id && f.friend_id === otherId) ||
          (f.friend_id === currentUser.id && f.user_id === otherId)
      ) || null
    );
  };

  // ➕ Send friend request
  const handleSendRequest = async (targetId: string) => {
    if (!currentUser) return;
    const existing = getFriendship(targetId);
    if (existing) {
      toast.error("Request already exists or you're already friends");
      return;
    }

    setActionLoading(targetId);
    const { error } = await supabase.from("friends").insert({
      user_id: currentUser.id,
      friend_id: targetId,
      status: "pending",
    });
    setActionLoading(null);

    if (error) {
      console.error(error);
      toast.error("Failed to send request");
    } else {
      toast.success("Friend request sent");
      loadFriends(currentUser.id);
    }
  };

  // ❌ Cancel my outgoing request
  const handleCancelRequest = async (friendshipId: string) => {
    if (!currentUser) return;
    setActionLoading(friendshipId);
    const { error } = await supabase.from("friends").delete().eq("id", friendshipId);
    setActionLoading(null);

    if (error) {
      console.error(error);
      toast.error("Failed to cancel");
    } else {
      toast.success("Request cancelled");
      loadFriends(currentUser.id);
    }
  };

  // ✅ Accept incoming
  const handleAccept = async (friendshipId: string) => {
    if (!currentUser) return;
    setActionLoading(friendshipId);
    const { error } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", friendshipId);
    setActionLoading(null);

    if (error) {
      console.error(error);
      toast.error("Failed to accept");
    } else {
      toast.success("Friend request accepted");
      loadFriends(currentUser.id);
    }
  };

  // 🚫 Decline incoming
  const handleDecline = async (friendshipId: string) => {
    if (!currentUser) return;
    setActionLoading(friendshipId);
    const { error } = await supabase.from("friends").delete().eq("id", friendshipId);
    setActionLoading(null);

    if (error) {
      console.error(error);
      toast.error("Failed to decline");
    } else {
      toast.success("Request declined");
      loadFriends(currentUser.id);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cyan-100">
        Loading session...
      </div>
    );
  }

  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  // Build lists for right-side panel
  const acceptedFriends: Profile[] = allUsers.filter((u) => {
    const fr = getFriendship(u.id);
    return fr && fr.status === "accepted";
  });

  const incomingRequests: { profile: Profile; row: FriendRow }[] = allUsers
    .map((u) => {
      const fr = getFriendship(u.id);
      if (fr && fr.status === "pending" && fr.friend_id === currentUser.id) {
        return { profile: u, row: fr };
      }
      return null;
    })
    .filter(Boolean) as any;

  const outgoingRequests: { profile: Profile; row: FriendRow }[] = allUsers
    .map((u) => {
      const fr = getFriendship(u.id);
      if (fr && fr.status === "pending" && fr.user_id === currentUser.id) {
        return { profile: u, row: fr };
      }
      return null;
    })
    .filter(Boolean) as any;

  return (
    <div className="min-h-screen px-4 py-6 md:px-10 bg-gradient-to-br from-[#05010a] via-[#060018] to-[#000915] text-foreground">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold neon-text mb-6">Friends</h1>

        {/* SEARCH BAR */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by username..."
            className="w-full rounded-xl bg-black/70 border border-cyan-400/70 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
          />
        </div>

        {loading ? (
          <div className="text-slate-200">Loading users...</div>
        ) : (
          <div className="grid md:grid-cols-[2fr,1.3fr] gap-6">
            {/* LEFT: ALL USERS + SEARCH RESULTS */}
            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <h2 className="text-lg font-semibold mb-3 text-cyan-100">
                All Users
              </h2>
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-slate-300">
                  No users match this search.
                </p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {filteredUsers.map((u) => {
                    const fr = getFriendship(u.id);
                    const isActionLoading =
                      actionLoading === u.id || actionLoading === fr?.id;

                    let buttonBlock: JSX.Element | null = null;

                    if (!fr) {
                      buttonBlock = (
                        <Button
                          size="sm"
                          disabled={isActionLoading}
                          onClick={() => handleSendRequest(u.id)}
                        >
                          Add Friend
                        </Button>
                      );
                    } else if (fr.status === "accepted") {
                      buttonBlock = (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/dm/${u.id}`)}
                        >
                          Message
                        </Button>
                      );
                    } else if (fr.status === "pending") {
                      if (fr.user_id === currentUser.id) {
                        // I sent the request
                        buttonBlock = (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isActionLoading}
                            onClick={() => handleCancelRequest(fr.id)}
                          >
                            Cancel
                          </Button>
                        );
                      } else {
                        // Incoming
                        buttonBlock = (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={isActionLoading}
                              onClick={() => handleAccept(fr.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isActionLoading}
                              onClick={() => handleDecline(fr.id)}
                            >
                              Decline
                            </Button>
                          </div>
                        );
                      }
                    }

                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl px-3 py-2 hover:border-cyan-400/60 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {u.username?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {u.username}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {u.id}
                            </span>
                          </div>
                        </div>
                        {buttonBlock}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: FRIEND STATUS PANEL */}
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <h3 className="text-sm font-semibold text-cyan-200 mb-2">
                  Incoming Requests
                </h3>
                {incomingRequests.length === 0 ? (
                  <p className="text-xs text-slate-400">No incoming requests.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {incomingRequests.map(({ profile, row }) => {
                      const isActionLoading = actionLoading === row.id;
                      return (
                        <div
                          key={row.id}
                          className="flex items-center justify-between text-sm bg-black/60 rounded-lg px-2 py-1 border border-white/10"
                        >
                          <span>{profile.username}</span>
                          <div className="flex gap-1">
                            <Button
                              size="xs"
                              disabled={isActionLoading}
                              onClick={() => handleAccept(row.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              size="xs"
                              variant="destructive"
                              disabled={isActionLoading}
                              onClick={() => handleDecline(row.id)}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <h3 className="text-sm font-semibold text-cyan-200 mb-2">
                  Outgoing Requests
                </h3>
                {outgoingRequests.length === 0 ? (
                  <p className="text-xs text-slate-400">No outgoing requests.</p>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {outgoingRequests.map(({ profile, row }) => {
                      const isActionLoading = actionLoading === row.id;
                      return (
                        <div
                          key={row.id}
                          className="flex items-center justify-between text-sm bg-black/60 rounded-lg px-2 py-1 border border-white/10"
                        >
                          <span>{profile.username}</span>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={isActionLoading}
                            onClick={() => handleCancelRequest(row.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <h3 className="text-sm font-semibold text-emerald-300 mb-2">
                  Friends
                </h3>
                {acceptedFriends.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    You have no friends yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {acceptedFriends.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between text-sm bg-black/60 rounded-lg px-2 py-1 border border-white/10"
                      >
                        <span>{f.username}</span>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => navigate(`/dm/${f.id}`)}
                        >
                          Message
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
