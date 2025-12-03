import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  Send,
  Smile,
  Paperclip,
  Hash,
  Phone,
  Pin,
  Search,
  Users,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MessageReactions from "./MessageReactions";
import TypingIndicator from "./TypingIndicator";
import SearchDialog from "./SearchDialog";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import CallOverlay from "@/components/call/CallOverlay";

interface ChatMainProps {
  user: any | null; // Supabase user
  selectedUserIdProp?: string | null;
}

const EMOJI_LIST = ["😀", "😄", "😂", "😍", "😢", "👍", "🔥", "🎉", "😉", "🤝"];

type Profile = { id: string; username: string | null; avatar_url: string | null };

const ChatMain = ({ user, selectedUserIdProp = null }: ChatMainProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [channelId, setChannelId] = useState<string>("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [friend, setFriend] = useState<Profile | null>(null);
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [groupMembers, setGroupMembers] = useState<Profile[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const { userId: pathUserId, groupId } = useParams<{
    userId?: string;
    groupId?: string;
  }>();
  const location = useLocation();

  // Selected user from prop / URL / query
  const selectedUserId =
    selectedUserIdProp ||
    pathUserId ||
    new URLSearchParams(location.search).get("dm");

  const isGroup = !!groupId && !selectedUserId;
  const isDM = !!selectedUserId && !groupId;

  // === WebRTC Call hook ===
  const {
    callState,
    incoming,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useWebRTCCall({
    currentUserId: user?.id || "",
    peerUserId: selectedUserId || "",
    dmChannelId: channelId || "",
  });

  // ===== Neon parallax background =====
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!bgRef.current) return;
      const speed = 0.015;
      bgRef.current.style.transform = `translate(${
        e.clientX * speed
      }px, ${e.clientY * speed}px) scale(1.05)`;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Mark DM as read when channel is active
  useEffect(() => {
    if (isDM && channelId) {
      markDmAsRead(channelId);
    }
  }, [isDM, channelId]);

  // ===== Auto-scroll to bottom =====
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ===== Fetch DM friend profile =====
  const fetchFriend = useCallback(async (id: string | null) => {
    if (!id) {
      setFriend(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("fetchFriend error", error);
      return;
    }
    if (data) setFriend(data as Profile);
  }, []);

  // ===== Fetch group meta =====
  const fetchGroup = useCallback(async (id: string | null) => {
    if (!id) {
      setGroup(null);
      return;
    }
    const { data, error } = await supabase
      .from("channels")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("fetchGroup error", error);
      return;
    }
    if (data) setGroup(data);
  }, []);

  // ===== Fetch group members =====
  const fetchGroupMembers = useCallback(async (chId: string | null) => {
    if (!chId) {
      setGroupMembers([]);
      return;
    }
    try {
      setLoadingMembers(true);

      const { data: memberRows, error: memberErr } = await supabase
        .from("channel_members")
        .select("user_id")
        .eq("channel_id", chId);

      if (memberErr) {
        console.error("fetchGroupMembers memberErr", memberErr);
        return;
      }

      const ids = (memberRows || []).map((r: any) => r.user_id);
      if (!ids.length) {
        setGroupMembers([]);
        return;
      }

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids);

      if (profErr) {
        console.error("fetchGroupMembers profErr", profErr);
        return;
      }

      setGroupMembers((profiles || []) as Profile[]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // ===== Init chat when route / user changes =====
  useEffect(() => {
    if (!user?.id) return;

    setMessages([]);
    setChannelId("");
    setFriend(null);
    setGroup(null);
    setGroupMembers([]);

    const init = async () => {
      try {
        setLoadingMessages(true);
        if (isDM && selectedUserId) {
          await fetchFriend(selectedUserId);
          await loadDMChannelAndMessages(selectedUserId);
        } else if (isGroup && groupId) {
          await fetchGroup(groupId);
          setChannelId(groupId);
          await loadGroupMessages(groupId);
          await fetchGroupMembers(groupId);
        }
      } catch (e) {
        console.error("init chat error", e);
        toast.error("Unable to load conversation");
      } finally {
        setLoadingMessages(false);
      }
    };

    init();
  }, [
    user?.id,
    isDM,
    isGroup,
    selectedUserId,
    groupId,
    fetchFriend,
    fetchGroup,
    fetchGroupMembers,
  ]);

  // ===== DM helpers =====
  const loadDMChannelAndMessages = async (
    otherUserId: string
  ): Promise<string | null> => {
    if (!user?.id) return null;

    const orFilter = `and(user1.eq.${user.id},user2.eq.${otherUserId}),and(user1.eq.${otherUserId},user2.eq.${user.id})`;

    const { data: rows, error: selErr } = await supabase
      .from("dm_channels")
      .select("id")
      .or(orFilter)
      .order("created_at", { ascending: true });

    if (selErr) throw selErr;

    let dmChannelId: string;

    if (rows && rows.length > 0) {
      dmChannelId = rows[0].id;
    } else {
      const { data: newDM, error: insertErr } = await supabase
        .from("dm_channels")
        .insert({ user1: user.id, user2: otherUserId })
        .select()
        .single();

      if (insertErr || !newDM) throw insertErr;
      dmChannelId = newDM.id;
    }

    setChannelId(dmChannelId);
    await loadDMMessages(dmChannelId);
    return dmChannelId;
  };

  const loadDMMessages = async (dmChannelId: string) => {
    try {
      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("dm_channel_id", dmChannelId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("loadDMMessages error", err);
      toast.error("Failed to load messages");
    }
  };

  const markDmAsRead = async (dmChannelId: string) => {
    if (!user?.id) return;
    await supabase.from("dm_read_state").upsert(
      {
        user_id: user.id,
        dm_channel_id: dmChannelId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,dm_channel_id" }
    );
  };

  // ===== Group helpers =====
  const loadGroupMessages = async (chId: string) => {
    try {
      const { data, error } = await supabase
        .from("channel_messages")
        .select("*")
        .eq("channel_id", chId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("loadGroupMessages error", err);
      toast.error("Failed to load group messages");
    }
  };

  // ===== Realtime subscription =====
  useEffect(() => {
    if (!channelId) return;

    const table = isDM ? "dm_messages" : "channel_messages";
    const col = isDM ? "dm_channel_id" : "channel_id";
    const filter = `${col}=eq.${channelId}`;
    const channelNameSub = `realtime-messages-${table}-${channelId}`;

    const realtimeChannel = supabase
      .channel(channelNameSub)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter },
        (payload) => {
          const newRow = payload.new;
          setMessages((prev) => [...prev, newRow]);
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(realtimeChannel);
      } catch {
        // ignore
      }
    };
  }, [channelId, isDM]);

  // ===== Delete message =====
  const handleDeleteMessage = async (msg: any) => {
    if (!user) return;

    const isOwn = isDM ? msg.sender_id === user.id : msg.user_id === user.id;

    if (!isOwn) {
      toast.error("You can only delete your own messages");
      return;
    }

    const table = isDM ? "dm_messages" : "channel_messages";

    try {
      const { error } = await supabase.from(table).delete().eq("id", msg.id);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } catch (err) {
      console.error("delete message error", err);
      toast.error("Failed to delete message");
    }
  };

  // ===== Send message =====
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;

    // DM
    if (isDM && selectedUserId) {
      let dmId = channelId;
      if (!dmId) {
        try {
          dmId = await loadDMChannelAndMessages(selectedUserId);
        } catch (err) {
          console.error("auto-create DM channel error", err);
          toast.error("Could not initialize DM");
          return;
        }
      }
      if (!dmId) return;

      const payload = {
        content: message.trim(),
        sender_id: user.id,
        dm_channel_id: dmId,
      };

      setMessage("");

      try {
        const { error } = await supabase.from("dm_messages").insert(payload);
        if (error) throw error;
      } catch (err) {
        console.error("send DM error", err);
        toast.error("Failed to send message");
      }
      return;
    }

    // GROUP
    if (isGroup && groupId) {
      const chId = channelId || groupId;
      if (!chId) return;

      const payload = {
        content: message.trim(),
        user_id: user.id,
        channel_id: chId,
      };

      setMessage("");

      try {
        const { error } = await supabase
          .from("channel_messages")
          .insert(payload);
        if (error) throw error;
      } catch (err) {
        console.error("send group error", err);
        toast.error("Failed to send message");
      }
      return;
    }
  };

  // ===== File upload (DM + group) =====
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    let currentChannelId = channelId;

    if (isDM && selectedUserId && !currentChannelId) {
      try {
        currentChannelId = await loadDMChannelAndMessages(selectedUserId);
      } catch (err) {
        console.error("auto-create DM channel error", err);
        toast.error("Could not initialize DM");
        return;
      }
    } else if (isGroup && groupId && !currentChannelId) {
      currentChannelId = groupId;
      setChannelId(groupId);
      await loadGroupMessages(groupId);
      await fetchGroupMembers(groupId);
    }

    if (!currentChannelId) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `attachments/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("attachments")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const table = isDM ? "dm_messages" : "channel_messages";

      const payload: any = isDM
        ? {
            content: file.name,
            attachment_url: publicUrl,
            attachment_type: file.type,
            sender_id: user.id,
            dm_channel_id: currentChannelId,
          }
        : {
            content: file.name,
            attachment_url: publicUrl,
            attachment_type: file.type,
            user_id: user.id,
            channel_id: currentChannelId,
          };

      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    } catch (err) {
      console.error("upload error", err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setEmojiOpen(false);
  };

  const headerTitle = isDM
    ? `DM with ${friend?.username || "Loading..."}`
    : isGroup && group
    ? group.name
    : "Select a chat";

  // ===== Empty state if no DM/group selected =====
  if (!isDM && !isGroup) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#05010a] via-[#060018] to-[#000915]">
        <div className="glass-card px-6 py-4 max-w-md text-center">
          <h2 className="text-xl font-semibold neon-text mb-2">
            Welcome to NEXUS
          </h2>
          <p className="text-sm text-slate-200">
            Pick a friend or group from the sidebar to start chatting.
          </p>
        </div>
      </div>
    );
  }

  // ===== MAIN CHAT UI =====
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-[#05010a] via-[#060018] to-[#000915]">
      {/* Glow background */}
      <div
        ref={bgRef}
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10% 20%, rgba(0,255,255,0.06) 0, transparent 55%), radial-gradient(circle at 80% 0%, rgba(255,0,255,0.12) 0, transparent 55%), radial-gradient(circle at 0% 100%, rgba(0,255,128,0.08) 0, transparent 55%)",
        }}
      />

      {/* Neon line next to sidebar */}
      <div className="pointer-events-none absolute top-0 left-0 h-full w-[2px] bg-gradient-to-b from-cyan-400 via-fuchsia-500 to-amber-400 shadow-[0_0_25px_rgba(0,255,255,0.8)]" />

      {/* Main chat card */}
      <div className="flex-1 flex px-2 sm:px-4 lg:px-8 py-4 min-h-0">
        <div className="flex flex-col w-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_0_40px_rgba(0,255,255,0.35)] overflow-hidden min-h-0">
          {/* Header */}
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-black/70 via-[#050018]/80 to-black/70">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-400 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,255,0.8)]">
                <Hash className="h-5 w-5 text-black" />
              </div>
              <div>
                <div className="text-lg font-semibold text-cyan-100 tracking-wide">
                  {headerTitle}
                </div>
                {isDM && friend?.username && (
                  <div className="text-xs text-emerald-300">● Online</div>
                )}
                {isGroup && (
                  <div className="text-xs text-slate-300 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {groupMembers.length} members online
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-white/10"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-white/10"
                disabled={!isDM || !selectedUserId || !channelId}
                onClick={() => {
                  if (!isDM || !selectedUserId || !channelId) return;
                  startCall();
                  setCallOpen(true);
                }}
                title={isDM ? "Start call" : "Calls only work in DMs"}
              >
                <Phone className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Call overlay */}
          <CallOverlay
            open={(callOpen || incoming) && isDM}
            onClose={() => setCallOpen(false)}
            callState={callState}
            incoming={incoming}
            friendName={friend?.username || "Friend"}
            localStream={localStream}
            remoteStream={remoteStream}
            onAccept={() => {
              acceptCall();
              setCallOpen(true);
            }}
            onReject={() => {
              rejectCall();
              setCallOpen(false);
            }}
            onHangup={() => {
              endCall();
              setCallOpen(false);
            }}
          />

          {/* Middle: messages (left) + group info (right) */}
          <div className="flex flex-1 min-h-0">
            {/* Messages area */}
            <div className="flex flex-col flex-[3] min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4">
                <div className="space-y-3">
                  {loadingMessages ? (
                    <div className="text-center text-sm text-slate-300 py-10">
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-sm text-slate-300 py-10">
                      No messages yet. Say hi 👋
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = isDM
                        ? msg.sender_id === user?.id
                        : msg.user_id === user?.id;

                      const senderLabel = isDM
                        ? isOwn
                          ? "You"
                          : friend?.username || "Friend"
                        : isOwn
                        ? "You"
                        : msg.user_id?.slice(0, 6) || "User";

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2 ${
                            isOwn ? "justify-end" : "justify-start"
                          }`}
                        >
                          {!isOwn && (
                            <Avatar className="h-8 w-8 border border-cyan-400/60 shadow-lg">
                              <AvatarFallback>
                                {senderLabel[0]?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div
                            className={`relative max-w-[75%] md:max-w-[60%] p-3 rounded-xl shadow-lg transition
                              ${
                                isOwn
                                  ? "ml-auto bg-gradient-to-br from-purple-700/60 to-blue-600/60 text-white"
                                  : "mr-auto bg-black/50 border border-purple-700/30 text-gray-200"
                              }`}
                          >
                            {/* top row: name + time + delete */}
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold tracking-wide">
                                {senderLabel}
                              </span>
                              <span className="text-[10px] opacity-70">
                                {msg.created_at
                                  ? new Date(
                                      msg.created_at
                                    ).toLocaleTimeString()
                                  : "just now"}
                              </span>
                              {isOwn && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg)}
                                  className="ml-1 text-[11px] opacity-70 hover:opacity-100 hover:text-red-400 transition"
                                  title="Delete message"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                              {msg.attachment_url && (
                                <Pin className="h-3 w-3 text-amber-200" />
                              )}
                            </div>

                            {msg.attachment_url ? (
                              msg.attachment_type?.startsWith("image/") ? (
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.content || "attachment"}
                                  className="max-w-xs rounded-md border border-white/10 mt-1"
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-sky-200 text-xs mt-1 inline-block"
                                >
                                  {msg.content || "Download attachment"}
                                </a>
                              )
                            ) : (
                              <p className="text-sm leading-relaxed break-words">
                                {msg.content}
                              </p>
                            )}

                            <MessageReactions
                              messageId={msg.id}
                              userId={user?.id}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div ref={scrollRef} />
                </div>

                <TypingIndicator
                  channelId={channelId}
                  currentUserId={user?.id}
                />
              </div>
            </div>

            {/* Group info panel (right) */}
            {isGroup && (
              <div className="hidden lg:flex flex-col flex-[1.2] border-l border-white/10 bg-black/60 px-4 py-4 min-h-0 overflow-y-auto">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-cyan-100">
                    Group Members
                  </h3>
                </div>

                {loadingMembers ? (
                  <p className="text-xs text-slate-300">Loading members...</p>
                ) : groupMembers.length === 0 ? (
                  <p className="text-xs text-slate-400">No members listed.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {groupMembers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback>
                              {(m.username?.[0] || "?").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-[13px]">
                              {m.username || m.id.slice(0, 6)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] text-emerald-300">
                            Online
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-white/10 bg-black/70 px-3 sm:px-6 py-3">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hover:bg-white/10"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Attach file"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <div className="relative flex-1">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Message ${headerTitle}`}
                  className="bg-black/70 border-cyan-500/60 text-white pr-12 rounded-full shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hover:bg-white/10"
                    onClick={() => setEmojiOpen((s) => !s)}
                    title="Emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>

                {emojiOpen && (
                  <div className="absolute bottom-full right-0 mb-2 z-50 bg-black/90 border border-purple-500/50 rounded-xl shadow-[0_0_25px_rgba(168,85,247,0.6)] p-2 grid grid-cols-5 gap-1">
                    {EMOJI_LIST.map((em) => (
                      <button
                        key={em}
                        type="button"
                        className="text-lg hover:scale-125 transition-transform"
                        onClick={() => insertEmoji(em)}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={!message.trim() || uploading}
                className="h-10 px-5 rounded-xl bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-amber-300 text-black font-semibold shadow-[0_0_18px_rgba(34,211,238,0.7)] hover:brightness-110 active:scale-95 transition"
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
};

export default ChatMain;
