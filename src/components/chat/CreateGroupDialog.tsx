import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Friend {
  id: string;
  username: string;
  avatar_url?: string;
}

interface CreateGroupDialogProps {
  userId: string;
  friends: Friend[];
  onGroupCreated?: () => void;
}

const CreateGroupDialog = ({ userId, friends, onGroupCreated }: CreateGroupDialogProps) => {
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleFriend = (id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Group name is required");
      return;
    }

    setLoading(true);
    try {
      // create channel (group)
      const { data: channel, error: chErr } = await supabase
        .from("channels")
        .insert({ name: groupName.trim() })
        .select()
        .single();

      if (chErr || !channel) {
        console.error(chErr);
        throw chErr;
      }

      const allMemberIds = Array.from(
        new Set<string>([userId, ...selectedFriendIds])
      );

      const rows = allMemberIds.map((uid) => ({
        channel_id: channel.id,
        user_id: uid,
      }));

      const { error: memErr } = await supabase
        .from("channel_members")
        .insert(rows);

      if (memErr) {
        console.error(memErr);
        throw memErr;
      }

      toast.success("Group created");
      setGroupName("");
      setSelectedFriendIds([]);
      setOpen(false);
      onGroupCreated && onGroupCreated();
    } catch (err) {
      console.error("Create group error:", err);
      toast.error("Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  if (!userId) return null;

  return (
    <div className="mb-2">
      {open ? (
        <form
          onSubmit={handleCreate}
          className="space-y-2 bg-slate-900/80 rounded-xl p-3 border border-slate-700"
        >
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
            className="h-8 text-xs bg-black/70 border-slate-600"
          />

          <div className="max-h-40 overflow-y-auto space-y-1">
            {friends.length === 0 ? (
              <p className="text-[10px] text-slate-400">
                You have no friends yet.
              </p>
            ) : (
              friends.map((f) => {
                const checked = selectedFriendIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-slate-800/70 rounded-md px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFriend(f.id)}
                      className="h-3 w-3"
                    />
                    <span>{f.username}</span>
                  </label>
                );
              })
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                setOpen(false);
                setGroupName("");
                setSelectedFriendIds([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="h-7 px-3 text-[11px] neon-button"
            >
              Create
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="sm"
          className="w-full h-8 text-[11px] neon-button"
          onClick={() => setOpen(true)}
        >
          + New Group
        </Button>
      )}
    </div>
  );
};

export default CreateGroupDialog;
