import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Register from './pages/Register';
import ProfileMe from './pages/ProfileMe';
import InboxDeck from './pages/InboxDeck';
import Discussions from './pages/Discussions';
import ThreadChat from './pages/ThreadChat';
import StoryViewer from './pages/StoryViewer';
import AddContact from './pages/AddContact';

function App() {
  return (
    <div className="min-h-screen bg-black flex justify-center w-full">
      <div className="w-full sm:max-w-[400px] h-full min-h-screen bg-[#0B0E14] relative shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-x-hidden">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<ProfileMe />} />
            <Route path="/inbox" element={<InboxDeck />} />
            <Route path="/discussions" element={<Discussions />} />
            <Route path="/chat" element={<ThreadChat />} />
            <Route path="/story" element={<StoryViewer />} />
            <Route path="/new" element={<AddContact />} />
            {/* Redirection fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  )
}

export default App
