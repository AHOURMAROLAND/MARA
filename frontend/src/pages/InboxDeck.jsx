import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, X, Trash2, Maximize2, Ghost } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function InboxDeck() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeck = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const res = await fetch('/api/v1/inbox/deck/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMessages(data.cards);
          }
        }
      } catch (err) {
        console.error('Error fetching inbox deck:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDeck();
  }, []);

  const currentMsg = messages[currentIndex];

  const nextMessage = () => {
    if (currentIndex < messages.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(messages.length); // Out of bounds = empty state
    }
  };

  const handleAction = async (action) => {
    if (!currentMsg) return;
    const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');

    if (action === 'reply' && currentMsg.thread_id) {
      navigate(`/thread?id=${currentMsg.thread_id}`);
      return;
    }

    if (action === 'story') {
      try {
        await fetch(`/api/v1/inbox/repost-story/${currentMsg.id}/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        alert('Ajouté en story !');
      } catch (err) {
        console.error('Error reposting to story:', err);
      }
      nextMessage();
      return;
    }

    // Ignore or Delete just skips for now (UI only)
    if (action === 'ignore' || action === 'delete') {
      nextMessage();
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0B0E14] text-white flex flex-col pt-12 px-4 space-y-4">
        <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse mb-8"></div>
        <div className="w-full h-[60vh] bg-[#161D2B] rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-8 pb-4">
        <button onClick={() => navigate('/discussions')} className="w-10 h-10 rounded-full bg-[#161D2B] border border-white/10 flex items-center justify-center hover:text-white text-white/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-extrabold text-white">Boîte Anonyme</h1>
          <p className="text-[10px] text-theme-muted uppercase tracking-widest">{messages.length > 0 ? messages.length - currentIndex : 0} Nouveaux</p>
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </header>

      {/* Main Deck Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {currentMsg ? (
          <div className="w-full max-w-sm aspect-[4/5] bg-gradient-to-br from-[#161D2B] to-[#111622] border border-white/10 rounded-[2rem] shadow-2xl relative flex flex-col items-center justify-center p-8 text-center animate-in slide-in-from-bottom-8 fade-in duration-500 overflow-hidden">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] uppercase font-bold text-theme-muted tracking-widest z-10 bg-black/50 px-3 py-1 rounded-full">
              {currentMsg.created_at}
            </div>
            
            {currentMsg.image_url ? (
              <div className="absolute inset-0 z-0">
                <img src={currentMsg.image_url} alt="Image reçue" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
              </div>
            ) : null}

            <p className="text-2xl font-extrabold text-white leading-tight mb-8 z-10 relative">
              "{currentMsg.text}"
            </p>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0B0E14] to-transparent rounded-b-[2rem] z-10">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleAction('ignore')}
                  className="bg-[#161D2B] text-white py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors border border-white/5"
                >
                  <X className="w-4 h-4" />
                  Ignorer
                </button>
                <button 
                  onClick={() => handleAction('reply')}
                  className="bg-mara-pink text-white py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-mara-pink/25 hover:bg-opacity-90 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Répondre
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button 
                  onClick={() => handleAction('story')}
                  className="bg-[#161D2B] text-white py-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors border border-white/5"
                >
                  <Maximize2 className="w-3 h-3 text-purple-400" />
                  En Story
                </button>
                <button 
                  onClick={() => handleAction('delete')}
                  className="bg-[#161D2B] text-red-400 py-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-red-500/10 transition-colors border border-red-500/10"
                >
                  <Trash2 className="w-3 h-3" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-[#161D2B] rounded-full mx-auto flex items-center justify-center mb-6 border border-white/5">
              <Ghost className="w-10 h-10 text-white/50" />
            </div>
            <h2 className="text-xl font-extrabold text-white mb-2">Tout est lu !</h2>
            <p className="text-theme-muted text-sm">Partage ton lien pour recevoir d'autres messages secrets.</p>
            <button 
              onClick={() => navigate('/profile')}
              className="mt-6 bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Partager mon lien
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
