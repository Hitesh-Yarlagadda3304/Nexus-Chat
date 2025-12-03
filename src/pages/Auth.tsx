import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Zap } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Welcome back!",
          description: "Logged in successfully",
        });
        navigate("/chat");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/chat`,
          },
        });
        if (error) throw error;
        toast({
          title: "Account created!",
          description: "You can now log in",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Cyberpunk grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      
      {/* Animated scan line */}
      <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan opacity-50" />

      <div className="w-full max-w-md p-8 relative">
        <div className="cyber-border bg-card/90 backdrop-blur-xl p-8 rounded-lg">
          <div className="flex items-center justify-center mb-6">
            <Zap className="h-12 w-12 text-primary animate-pulse-glow" />
          </div>
          
          <h1 className="text-3xl font-bold text-center mb-2 text-glow text-primary">
            {isLogin ? "NEURAL LINK" : "INITIALIZE"}
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            {isLogin ? "Authenticate to access the network" : "Create your digital identity"}
          </p>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-input border-primary/30 focus:border-primary glow-cyan transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-input border-primary/30 focus:border-primary glow-cyan transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground glow-cyan font-bold"
            >
              {loading ? "PROCESSING..." : isLogin ? "CONNECT" : "REGISTER"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Need an account? Register" : "Already registered? Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
