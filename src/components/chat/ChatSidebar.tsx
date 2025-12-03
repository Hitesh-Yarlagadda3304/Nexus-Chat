// src/components/chat/ChatSidebar.tsx
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut, Zap, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import CreateGroupDialog from "./CreateGroupDialog";

interface ChatSidebarProps {
  user: User | null;
}

const ChatSidebar = ({ user }: ChatSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();

  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [unreadByFriend, setUnreadByFriend] = useState<Record<string, number>>(
    {}
  );
  const [profile, setProfile] = useState<{
    avatar_url?: string | null;
    username?: string | null;
  } | null>(null);

  // ---- Load current user's profile (for footer avatar) ----
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!error && data) setProfile(data);
    };
    loadProfile();
  }, [user]);

  // ---- Load friends (accepted both directions) ----
  const loadFriends = async (userId: string) => {
    try {
      // requester
      const { data: asUser, error: e1 } = await supabase
        .from("friends")
        .select("friend_id, status")
        .eq("user_id", userId)
        .eq("status", "accepted");

      if (e1) throw e1;

      // recipient
      const { data: asFriend, error: e2 } = await supabase
        .from("friends")
        .select("user_id, status")
        .eq("friend_id", userId)
        .eq("status", "accepted");

      if (e2) throw e2;

      const ids = new Set<string>();
      (asUser || []).forEach((r) => ids.add(r.friend_id));
      (asFriend || []).forEach((r) => ids.add(r.user_id));

      if (ids.size === 0) {
        setFriends([]);
        setUnreadByFriend({});
        return [];
      }

      const { data: profs, error: e3 } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", Array.from(ids));

      if (e3) throw e3;

      const list = profs || [];
      setFriends(list);
      return list;
    } catch (err) {
      console.error("Friend Load Error:", err);
      setFriends([]);
      setUnreadByFriend({});
      return [];
    }
  };

  // ---- Load groups for the user ----
  const loadGroups = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("channel_members")
        .select("channel:channels!channel_members_channel_id_fkey(id, name)")
        .eq("user_id", userId);

      if (error) throw error;

      const cleaned = (data || [])
        .map((row: any) => row.channel)
        .filter(Boolean);

      setGroups(cleaned);
    } catch (err) {
      console.error("Load groups error:", err);
      setGroups([]);
    }
  };

  // ---- Unread DM counts ----
  const loadUnreadCounts = async (userId: string, friendIds: string[]) => {
    const result: Record<string, number> = {};

    await Promise.all(
      friendIds.map(async (fid) => {
        // find dm_channel between me + friend
        const { data: dm, error: dmErr } = await supabase
          .from("dm_channels")
          .select("id")
          .or(
            `and(user1.eq.${userId},user2.eq.${fid}),and(user1.eq.${fid},user2.eq.${userId})`
          )
          .maybeSingle();

        if (dmErr || !dm?.id) return;

        const { data: readRow } = await supabase
          .from("dm_read_state")
          .select("last_read_at")
          .eq("user_id", userId)
          .eq("dm_channel_id", dm.id)
          .maybeSingle();

        const lastRead = readRow?.last_read_at || "1970-01-01T00:00:00Z";

        const { count } = await supabase
          .from("dm_messages")
          .select("id", { count: "exact", head: true })
          .eq("dm_channel_id", dm.id)
          .gt("created_at", lastRead);

        result[fid] = count || 0;
      })
    );

    setUnreadByFriend(result);
  };

  // ---- Initial load + reload when user changes ----
  useEffect(() => {
    if (!user) return;

    const run = async () => {
      const list = await loadFriends(user.id);
      await loadGroups(user.id);
      const ids = list.map((f: any) => f.id);
      if (ids.length) {
        await loadUnreadCounts(user.id, ids);
      }
    };

    run();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDMClick = (friendId: string) => {
    navigate(`/dm/${friendId}`);
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/group/${groupId}`);
  };

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      {/* Top bar */}
      <div className="h-14 border-b border-border flex items-center px-4 bg-card">
        <SidebarTrigger />
        {!isCollapsed && (
          <div className="flex items-center gap-2 ml-2">
            <Zap className="h-5 w-5 text-primary animate-pulse-glow" />
            <h1
              onClick={() => navigate("/")}
              className="cursor-pointer hover:text-primary transition font-bold text-primary"
            >
              NEXUS
            </h1>
          </div>
        )}
      </div>

      <SidebarContent className="bg-sidebar">
        {/* GROUPS */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-secondary/70 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {!isCollapsed && "GROUPS"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {!isCollapsed && user && (
              <CreateGroupDialog
                userId={user.id}
                friends={friends}
                onGroupCreated={() => loadGroups(user.id)}
              />
            )}

            <SidebarMenu>
              {groups.length > 0 ? (
                groups.map((g: any) => (
                  <SidebarMenuItem key={g.id}>
                    <SidebarMenuButton
                      onClick={() => handleGroupClick(g.id)}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent transition"
                    >
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-[11px] text-black font-semibold">
                        {g.name?.[0]?.toUpperCase() || "G"}
                      </div>
                      {!isCollapsed && g.name}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                !isCollapsed && (
                  <p className="text-[11px] text-slate-400 px-2 mt-1">
                    No groups yet
                  </p>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* DIRECT MESSAGES */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary/70">
            DIRECT MESSAGES
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Add Friends */}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate("/friends")}>
                  <UserPlus className="h-4 w-4 text-secondary" />
                  {!isCollapsed && "Add Friends"}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Friend list with unread badges */}
              {friends.length > 0 ? (
                friends.map((f: any) => (
                  <SidebarMenuItem key={f.id}>
                    <SidebarMenuButton
                      onClick={() => handleDMClick(f.id)}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent transition"
                    >
                      <Avatar className="h-6 w-6">
                        {f.avatar_url ? (
                          <img
                            src={f.avatar_url}
                            alt={f.username || "avatar"}
                            className="h-full w-full object-cover rounded-full"
                          />
                        ) : (
                          <AvatarFallback>
                            {(f.username?.[0] || "?").toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>

                      {!isCollapsed && (
                        <div className="flex items-center w-full justify-between">
                          <span>{f.username}</span>
                          {unreadByFriend[f.id] > 0 && (
                            <span className="ml-2 text-[10px] rounded-full bg-fuchsia-500/90 text-black px-1.5 py-[1px]">
                              {unreadByFriend[f.id]}
                            </span>
                          )}
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <p className="text-xs opacity-50 px-2 mt-2">
                  {!isCollapsed && "No friends yet"}
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* USER FOOTER */}
        <div className="mt-auto p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-8 w-8 border-2 border-primary">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username || "You"}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <AvatarFallback>
                  {(user?.email?.[0] || "U").toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>

            {!isCollapsed && (
              <div>
                <p className="text-sm font-medium">
                  {profile?.username || user?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-green-400">● Online</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex gap-2">
              <Button onClick={() => navigate("/settings")} className="flex-1">
                <Settings className="h-4 w-4" />
              </Button>

              <Button
                onClick={handleLogout}
                variant="destructive"
                className="flex-1"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

export default ChatSidebar;
