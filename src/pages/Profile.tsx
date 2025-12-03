import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";

type ProfileRow = {
  id: string;
  username: string | null;
  bio: string | null;
  status_message: string | null;
  avatar_url: string | null;
};

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  // Load current user + profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error("No auth user", userError);
          navigate("/auth");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, bio, status_message, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Load profile error", error);
          toast.error("Failed to load profile");
          return;
        }

        // If no profile row yet, create one
        if (!data) {
          const { data: inserted, error: insertErr } = await supabase
            .from("profiles")
            .insert({ id: user.id, username: user.email?.split("@")[0] })
            .select("id, username, bio, status_message, avatar_url")
            .single();

          if (insertErr) {
            console.error("Insert profile error", insertErr);
            toast.error("Failed to initialize profile");
            return;
          }

          setProfile(inserted as ProfileRow);
          setUsername(inserted.username || "");
          setBio(inserted.bio || "");
          setStatusMessage(inserted.status_message || "");
          setAvatarUrl(inserted.avatar_url || null);
        } else {
          const prof = data as ProfileRow;
          setProfile(prof);
          setUsername(prof.username || "");
          setBio(prof.bio || "");
          setStatusMessage(prof.status_message || "");
          setAvatarUrl(prof.avatar_url || null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  // Handle avatar upload
  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!profile?.id) {
      toast.error("Profile not loaded yet");
      return;
    }

    try {
      setUploadingAvatar(true);

      const ext = file.name.split(".").pop();
      const filePath = `avatars/${profile.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newUrl = publicUrlData.publicUrl;
      setAvatarUrl(newUrl);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", profile.id);

      if (updateErr) throw updateErr;

      toast.success("Avatar updated");
    } catch (err) {
      console.error("Avatar upload error", err);
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save username + bio + status
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    try {
      setSaving(true);

      const updates = {
        username: username.trim() || null,
        bio: bio.trim() || null,
        status_message: statusMessage.trim() || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);

      if (error) throw error;

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
              avatar_url: avatarUrl ?? prev.avatar_url,
            }
          : prev
      );

      toast.success("Profile updated");
    } catch (err) {
      console.error("Save profile error", err);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-200">
        Failed to load profile.
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-6">
      <div className="glass-card max-w-lg w-full p-6 rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_0_40px_rgba(0,255,255,0.35)]">
        <h1 className="text-2xl font-bold neon-text mb-4 text-center">
          Edit Profile
        </h1>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-3">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.8)]">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <AvatarFallback className="text-xl">
                    {username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                )}
              </Avatar>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg hover:brightness-110 active:scale-95 transition"
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <Camera className="h-4 w-4 text-black" />
                )}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 uppercase tracking-wide">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your display name"
              className="bg-black/60 border-cyan-500/60 text-white"
            />
          </div>

          {/* Status message */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 uppercase tracking-wide">
              Status
            </label>
            <Input
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. Coding all night 🌙"
              className="bg-black/60 border-purple-500/60 text-white"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 uppercase tracking-wide">
              Bio
            </label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people something about you..."
              className="bg-black/60 border-slate-600 text-white min-h-[80px]"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="border-slate-600 text-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-amber-300 text-black font-semibold shadow-[0_0_18px_rgba(34,211,238,0.7)] hover:brightness-110 active:scale-95 transition"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
