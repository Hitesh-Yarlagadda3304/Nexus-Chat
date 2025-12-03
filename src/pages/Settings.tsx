import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // NEW
  const [usernameChanged, setUsernameChanged] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setUsername(data.username || "");
      setBio(data.bio || "");
      setStatus(data.status || "");
      setAvatarUrl(data.avatar_url || "");

      // NEW: Load lock status
      setUsernameChanged(data.username_changed || false);
    }
    setLoading(false);
  };

const handleSaveProfile = async () => {
  if (!user) return;

  // If username changed before → block username edit
  if (usernameChanged) {
    toast.error("You can only change your username once.");
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      bio,
      status,
      avatar_url: avatarUrl,
      username_changed: true  // LOCK username
    })
    .eq("id", user.id);

  if (error) {
    toast.error("Failed to update profile");
  } else {
    toast.success("Profile updated successfully");
    setUsernameChanged(true); // Lock in frontend
  }
};



const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !user) return;

  setUploading(true);
  try {
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")                      // 👈 use avatars bucket
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/jpeg",
      });

    if (uploadError) {
      console.error(uploadError);
      toast.error("Failed to upload avatar");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Save to state
    setAvatarUrl(publicUrl);

    // Also save into profiles.avatar_url
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      console.error(updateError);
      toast.error("Avatar uploaded but profile not updated");
      return;
    }

    toast.success("Avatar updated");
  } finally {
    setUploading(false);
  }
};


  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/chat")}
          className="mb-6 hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Chat
        </Button>

        <div className="bg-card rounded-lg cyber-border p-6">
          <h1 className="text-2xl font-bold text-primary text-glow mb-6">
            User Settings
          </h1>

          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-primary glow-cyan">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                    {username[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
                <Button
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  disabled={uploading}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Avatar"}
                </Button>
              </div>
            </div>

            {/* Username (only once) */}
            <div>
              <Label htmlFor="username" className="text-foreground">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                disabled={usernameChanged} // ❌ disabled after first update
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 bg-input border-primary/20"
              />

              {usernameChanged && (
                <p className="text-red-500 text-sm mt-1">
                  You have already changed your username once.
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status" className="text-foreground">
                Status Message
              </Label>
              <Input
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="What's on your mind?"
                className="mt-2 bg-input border-primary/20"
              />
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio" className="text-foreground">
                Bio
              </Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="mt-2 bg-input border-primary/20 min-h-[100px]"
              />
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSaveProfile}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Settings;
