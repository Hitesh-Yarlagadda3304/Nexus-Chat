import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Hash, User, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);

    // Search messages
    const { data: messages } = await supabase
      .from("messages")
      .select("*, profiles(username)")
      .ilike("content", `%${searchQuery}%`)
      .limit(10);

    // Search users
    const { data: users } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${searchQuery}%`)
      .limit(10);

    // Search channels
    const { data: channels } = await supabase
      .from("channels")
      .select("*")
      .ilike("name", `%${searchQuery}%`)
      .limit(10);

    const combined = [
      ...(channels?.map((c) => ({ type: "channel", data: c })) || []),
      ...(users?.map((u) => ({ type: "user", data: u })) || []),
      ...(messages?.map((m) => ({ type: "message", data: m })) || []),
    ];

    setResults(combined);
    setLoading(false);
  };

  const handleResultClick = (result: any) => {
    if (result.type === "user") {
      navigate(`/profile/${result.data.id}`);
    } else if (result.type === "channel") {
      navigate("/chat");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-primary">Search</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search messages, users, or channels..."
            className="pl-10 bg-input border-primary/20"
          />
        </div>

        <ScrollArea className="h-96">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Searching...</div>
          ) : results.length === 0 && query ? (
            <div className="text-center py-8 text-muted-foreground">No results found</div>
          ) : (
            <div className="space-y-2">
              {results.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleResultClick(result)}
                  className="w-full p-3 hover:bg-muted rounded-lg text-left flex items-center gap-3 transition-colors"
                >
                  {result.type === "channel" && <Hash className="h-4 w-4 text-primary" />}
                  {result.type === "user" && <User className="h-4 w-4 text-secondary" />}
                  {result.type === "message" && <MessageSquare className="h-4 w-4 text-muted-foreground" />}

                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {result.type === "channel" && `#${result.data.name}`}
                      {result.type === "user" && result.data.username}
                      {result.type === "message" && result.data.profiles?.username}
                    </p>
                    {result.type === "message" && (
                      <p className="text-sm text-muted-foreground truncate">{result.data.content}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
