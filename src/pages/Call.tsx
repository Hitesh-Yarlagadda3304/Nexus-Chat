import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Call = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const endCall = () => {
    navigate("/chat");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary rounded-full blur-3xl animate-pulse-glow" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Call Info */}
        <div className="text-center space-y-4">
          <Avatar className="h-32 w-32 border-4 border-primary glow-cyan mx-auto">
            <AvatarFallback className="bg-primary/20 text-primary text-4xl">
              {user?.email?.[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold text-primary text-glow">
              {user?.email?.split("@")[0]}
            </h2>
            <p className="text-muted-foreground mt-2">{formatDuration(callDuration)}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
              <span className="text-success text-sm">Connected</span>
            </div>
          </div>
        </div>

        {/* Call Controls */}
        <div className="flex gap-4 p-6 bg-card/50 backdrop-blur rounded-lg cyber-border">
          <Button
            size="lg"
            variant={isMuted ? "destructive" : "secondary"}
            onClick={() => setIsMuted(!isMuted)}
            className="h-14 w-14 rounded-full glow-cyan"
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <Button
            size="lg"
            variant={isVideoOff ? "destructive" : "secondary"}
            onClick={() => setIsVideoOff(!isVideoOff)}
            className="h-14 w-14 rounded-full glow-magenta"
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={endCall}
            className="h-14 w-14 rounded-full bg-destructive hover:bg-destructive/90"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {/* Call Features Info */}
        <div className="text-center text-muted-foreground text-sm space-y-1">
          <p>🎥 Video calling feature coming soon</p>
          <p>This is a UI preview - full calling functionality will be added</p>
        </div>
      </div>
    </div>
  );
};

export default Call;
