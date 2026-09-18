import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MoreVertical, Send, Users } from 'lucide-react';

export default function GroupChat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('id');

  const [messages, setMessages] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Placeholder fetching logic
    // Usually this would call /api/v1/groups/{groupId}/messages/
    setTimeout(() => {
      setGroupInfo({ id: groupId, name: 'Secret Squad', participants: 4 });
      setMessages([
        { id: 1, text: 'Hello team!', sender_pseudo: 'A', is_me: false, created_at: '10:00' },
        { id: 2, text: 'Hi A!', sender_pseudo: 'Moi', is_me: true, created_at: '10:01' }
      ]);
      setLoading(false);
      scrollToBottom();
    }, 500);
  }, [groupId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msg = {
      id: Date.now(),
      text: newMessage.trim(),
      sender_pseudo: 'Moi',
      is_me: true,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, msg]);
    setNewMessage('');
    scrollToBottom();
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0B0E14] text-white flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col relative">
      <header className="px-4 py-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md z-40 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-lg">
              {groupInfo?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">{groupInfo?.name}</h1>
              <p className="text-[10px] text-theme-muted flex items-center gap-1">
                <Users className="w-3 h-3" /> {groupInfo?.participants} membres
              </p>
            </div>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 hide-scrollbar flex flex-col space-y-4">
        {messages.map((msg, idx) => {
          const showSender = !msg.is_me && (idx === 0 || messages[idx - 1].sender_pseudo !== msg.sender_pseudo);
          return (
            <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className="max-w-[75%] flex flex-col">
                {showSender && <span className="text-[10px] text-theme-muted font-bold ml-2 mb-1">{msg.sender_pseudo}</span>}
                <div className={`p-3.5 rounded-3xl ${
                  msg.is_me 
                    ? 'bg-mara-pink text-white rounded-br-sm shadow-md shadow-mara-pink/20' 
                    : 'bg-[#161D2B] text-white rounded-bl-sm border border-white/5'
                }`}>
                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                </div>
                <div className={`flex items-center gap-1 mt-1 ${msg.is_me ? 'justify-end' : 'justify-start ml-2'}`}>
                  <span className="text-[10px] text-theme-muted font-bold">{msg.created_at}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-md mx-auto">
          <div className="flex-1 bg-[#161D2B] rounded-full flex items-center border border-white/10 overflow-hidden pr-2">
            <input 
              type="text" 
              placeholder="Message au groupe..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white px-5 py-3.5 outline-none placeholder:text-theme-muted"
            />
          </div>
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="w-12 h-12 flex-shrink-0 bg-mara-pink rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:bg-[#161D2B] disabled:text-theme-muted transition-all"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
