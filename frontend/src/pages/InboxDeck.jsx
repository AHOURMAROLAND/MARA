import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, X, Trash2, Maximize2 } from 'lucide-react';

export default function InboxDeck() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { id: 1, text: "J'adore ce que tu fais !", time: "Il y a 2h" },
    { id: 2, text: "C'est quoi ton secret pour être si cool ?", time: "Il y a 5h" },
    { id: 3, text: "Salut, on peut discuter ?", time: "Hier" }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentMsg = messages[currentIndex];

  const nextMessage = () => {
    if (currentIndex < messages.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleAction = (action) => {
    // Handle action here (e.g. Delete, Ignore, Reply)
    console.log(`Action: ${action} on message ${currentMsg?.id}`);
    nextMessage();
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-8 pb-4">
        <button onClick={() => navigate('/discussions')} className="w-10 h-10 rounded-full bg-[#161D2B] border border-white/10 flex items-center justify-center hover:text-white text-white/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-extrabold text-white">Boîte Anonyme</h1>
          <p className="text-[10px] text-theme-muted uppercase tracking-widest">{messages.length - currentIndex} Nouveaux</p>
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </header>

      {/* Main Deck Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {currentMsg ? (
          <div className="w-full max-w-sm aspect-[4/5] bg-gradient-to-br from-[#161D2B] to-[#111622] border border-white/10 rounded-[2rem] shadow-2xl relative flex flex-col items-center justify-center p-8 text-center animate-in slide-in-from-bottom-8 fade-in duration-500">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] uppercase font-bold text-theme-muted tracking-widest">
              {currentMsg.time}
            </div>
            
            <p className="text-2xl font-extrabold text-white leading-tight mb-8">
              "{currentMsg.text}"
            </p>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0B0E14] to-transparent rounded-b-[2rem]">
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
              <span className="text-3xl">👻</span>
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
