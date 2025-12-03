import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatMain from "@/components/chat/ChatMain";
import { SidebarProvider } from "@/components/ui/sidebar";

const Chat = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <div className="p-6">Not logged in</div>;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-black via-[#080013] to-black">

        {/* Mobile toggle button */}
        <button
          className="md:hidden fixed bottom-4 left-4 z-50 px-4 py-2 rounded-full bg-purple-600 text-white shadow-lg"
          onClick={() => setSidebarOpen((s) => !s)}
        >
          ☰
        </button>

        {/* Sidebar desktop */}
        <div className="hidden md:block w-64 border-r border-purple-800/30 bg-black/90">
          <ChatSidebar user={user} />
        </div>

        {/* Sidebar mobile overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-y-0 left-0 w-64 bg-black z-40 border-r border-purple-800/80">
            <ChatSidebar user={user} />
          </div>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex">
          <ChatMain user={user} />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
