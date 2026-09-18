import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal, Lock, Send } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function ThreadChat() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const threadId = searchParams.get('id');
  
  const [message, setMessage] = useState('');
  const [threadData, setThreadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!threadId) return;

    const fetchThread = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const res = await fetch(`/api/v1/threads/${threadId}/`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setThreadData(data.thread);
            scrollToBottom();
          }
        }
      } catch (err) {
        console.error('Error fetching thread:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchThread();
  }, [threadId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !threadId) return;

    const msgText = message.trim();
    setMessage('');

    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/threads/${threadId}/send/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: msgText })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setThreadData(prev => ({
            ...prev,
            messages: [...prev.messages, data.message]
          }));
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleReveal = async () => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/threads/${threadId}/reveal/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.revealed) {
        navigate(`/chat?id=${data.conversation_id}`);
      } else {
        showToast(data.message || 'Impossible de révéler.', 'error');
      }
    } catch (err) {
      console.error('Error revealing:', err);
    }
  };

  const handleClose = async () => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/threads/${threadId}/close/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        navigate('/discussions');
      }
    } catch (err) {
      console.error('Error closing thread:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0B0E14] text-white flex flex-col relative overflow-hidden">
        {/* Skeleton Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-white/5 bg-[#0B0E14]/90 z-40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse"></div>
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse"></div>
            <div className="w-32 h-5 bg-white/10 rounded-full animate-pulse"></div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
        </header>

        {/* Skeleton Messages */}
        <main className="flex-1 overflow-hidden px-4 pt-6 flex flex-col gap-6">
          <div className="flex justify-start">
            <div className="w-48 h-12 bg-white/5 rounded-3xl rounded-bl-sm animate-pulse"></div>
          </div>
          <div className="flex justify-end">
            <div className="w-32 h-10 bg-mara-pink/20 rounded-3xl rounded-br-sm animate-pulse"></div>
          </div>
          <div className="flex justify-start">
            <div className="w-64 h-16 bg-white/5 rounded-3xl rounded-bl-sm animate-pulse"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!threadData) {
    return <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-white">Fil introuvable.</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col relative">
      {/* Header */}
      <header className="px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md z-40 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Fil anonyme</h1>
        <button className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <MoreHorizontal className="w-5 h-5 text-white" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-32 hide-scrollbar flex flex-col pt-2">
        {/* Thread Info */}
        <div className="flex flex-col items-center mt-6 mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-mara-pink to-purple-600 blur-[2px] mb-4 flex items-center justify-center shadow-[0_0_30px_rgba(255,69,101,0.3)]">
            <div className="w-[90%] h-[90%] bg-[#0B0E14]/50 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-4xl opacity-50">👤</span>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-1">Message anonyme</h2>
          <p className="text-xs text-theme-muted max-w-[250px] leading-relaxed">
            Quelqu'un t'a envoyé un message sans révéler son identité
          </p>
        </div>

        {/* Initial Message as first bubble if it exists */}
        <div className="space-y-4 flex-1">
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-mara-pink to-purple-600 blur-[1px] mr-2 flex-shrink-0 flex items-center justify-center self-end mb-1">
              <span className="text-xs opacity-50">👤</span>
            </div>
            <div className="max-w-[75%]">
              <div className="p-4 rounded-3xl bg-[#161D2B] text-white rounded-bl-sm border border-white/5">
                {threadData.initial_message?.image_url && (
                  <img src={threadData.initial_message.image_url} alt="Image reçue" className="w-full rounded-xl mb-2" />
                )}
                <p className="text-sm font-medium leading-relaxed">{threadData.initial_message?.text}</p>
              </div>
              <div className="flex items-center gap-1 mt-1 justify-start ml-2">
                <span className="text-[10px] text-theme-muted font-bold">{threadData.initial_message?.created_at}</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          {threadData.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              {!msg.is_me && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-mara-pink to-purple-600 blur-[1px] mr-2 flex-shrink-0 flex items-center justify-center self-end mb-1">
                  <span className="text-xs opacity-50">👤</span>
                </div>
              )}
              
              <div className="max-w-[75%]">
                <div className={`p-4 rounded-3xl ${
                  msg.is_me 
                    ? 'bg-gradient-to-br from-[#FF4565] to-[#FF8038] text-white rounded-br-sm shadow-lg shadow-mara-pink/20' 
                    : 'bg-[#161D2B] text-white rounded-bl-sm border border-white/5'
                }`}>
                  {msg.image_url && <img src={msg.image_url} alt="" className="w-full rounded-xl mb-2" />}
                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                </div>
                <div className={`flex items-center gap-1 mt-1 ${msg.is_me ? 'justify-end' : 'justify-start ml-2'}`}>
                  <span className="text-[10px] text-theme-muted font-bold">{msg.created_at}</span>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Safety Banner & Actions */}
        {threadData.status !== 'closed' && threadData.is_recipient && (
          <div className="mt-8 mb-4 space-y-4">
            <div className="bg-[#161D2B] border border-white/5 rounded-xl py-3 px-4 flex items-center justify-center gap-3">
              <Lock className="w-4 h-4 text-mara-pink" />
              <span className="text-[10px] font-bold text-white/80">Ton identité reste secrète tant que tu ne révèles rien</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleReveal} className="bg-gradient-to-r from-[#FF4565] to-[#FF8038] text-white py-4 rounded-2xl text-sm font-extrabold shadow-lg shadow-mara-pink/25 hover:opacity-90 transition-opacity">
                Découvrir qui c'est
              </button>
              <button onClick={handleClose} className="bg-[#161D2B] border border-white/10 text-white py-4 rounded-2xl text-sm font-extrabold hover:bg-white/5 transition-colors">
                Clore la discussion
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Message Input Container */}
      {threadData.status !== 'closed' && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-md mx-auto">
            <div className="flex-1 bg-[#161D2B] rounded-full flex items-center border border-white/10 overflow-hidden pr-2">
              <input 
                type="text" 
                placeholder="Écrire un message..." 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white px-5 py-3.5 outline-none placeholder:text-theme-muted"
              />
            </div>
            <button 
              type="submit"
              disabled={!message.trim()}
              className="w-12 h-12 flex-shrink-0 bg-[#161D2B] rounded-full flex items-center justify-center text-white/80 border border-white/10 hover:text-white transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
