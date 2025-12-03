import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Friends from "./pages/Friends";
import FriendRequests from "./pages/FriendRequests";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/auth" element={<Auth />} />

        <Route path="/friends" element={<Friends />} />
        <Route path="/friend-requests" element={<FriendRequests />} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />

        {/* Chat routes */}
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:userId" element={<Chat />} />
        <Route path="/dm/:userId" element={<Chat />} />
<Route path="/" element={<Chat />} />
<Route path="/dm/:userId" element={<Chat />} />
<Route path="/group/:groupId" element={<Chat />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
