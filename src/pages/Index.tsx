import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, MessageSquare, Users, Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Cyberpunk grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      
      {/* Animated elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-pulse-glow" />

      <div className="relative z-10">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-20">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <div className="mb-6 animate-flicker">
              <Zap className="h-20 w-20 text-primary glow-cyan" />
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold mb-6 text-glow bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              NEXUS CHAT
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl">
              Enter the digital realm. Connect, communicate, collaborate in a cyberpunk universe.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => navigate("/auth")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan font-bold text-lg px-8 py-6"
              >
                ENTER THE MATRIX
              </Button>
              <Button
                onClick={() => navigate("/friends")}
                variant="outline"
                className="border-primary/50 hover:bg-primary/10 glow-cyan text-lg px-8 py-6"
              >
                EXPLORE
              </Button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="cyber-border bg-card/50 backdrop-blur p-6 rounded-lg text-center group hover:scale-105 transition-transform">
              <MessageSquare className="h-12 w-12 text-primary mx-auto mb-4 group-hover:glow-cyan transition-all" />
              <h3 className="text-xl font-bold text-foreground mb-2">Real-time Chat</h3>
              <p className="text-muted-foreground">
                Instant messaging with zero latency in the neural network
              </p>
            </div>

            <div className="cyber-border bg-card/50 backdrop-blur p-6 rounded-lg text-center group hover:scale-105 transition-transform">
              <Users className="h-12 w-12 text-secondary mx-auto mb-4 group-hover:glow-magenta transition-all" />
              <h3 className="text-xl font-bold text-foreground mb-2">Communities</h3>
              <p className="text-muted-foreground">
                Join servers and channels to connect with like-minded users
              </p>
            </div>

            <div className="cyber-border bg-card/50 backdrop-blur p-6 rounded-lg text-center group hover:scale-105 transition-transform">
              <Shield className="h-12 w-12 text-success mx-auto mb-4 group-hover:glow-green transition-all" />
              <h3 className="text-xl font-bold text-foreground mb-2">Secure</h3>
              <p className="text-muted-foreground">
                End-to-end encryption keeps your conversations private
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
