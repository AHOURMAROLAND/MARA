import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import BottomNav from '../components/BottomNav';

export default function Discussions() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const stories = [
    { id: 1, pseudo: 'Yuna', isUnseen: true },
    { id: 2, pseudo: 'Alex', isUnseen: true },
    { id: 3, pseudo: 'Sarah', isUnseen: false },
    { id: 4, pseudo: 'Mike', isUnseen: false },
  ];

  const conversations = [
    { id: 1, name: 'Yuna', lastMessage: "On se voit ce soir ?", time: '12:30', unread: 2, isGroup: false },
    { id: 2, name: 'Message anonyme', lastMessage: "Quelqu'un t'a envoyé...", time: '11:15', unread: 1, isGroup: false, isAnonymous: true },
    { id: 3, name: 'Projet X', lastMessage: "Alex: J'ai fini ma partie", time: 'Hier', unread: 0, isGroup: true },
    { id: 4, name: 'Sarah', lastMessage: "Mdrrr, t'es grave", time: 'Hier', unread: 0, isGroup: false },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col pb-24 relative overflow-y-auto hide-scrollbar">
      {/* Header */}
      <header className="px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md z-40">
        <h1 className="text-3xl font-extrabold tracking-tight">Discussions</h1>
        <div className="w-10 h-10 rounded-full story-ring-active flex items-center justify-center bg-[#161D2B]">
          <span className="font-bold">A</span>
        </div>
      </header>

      {/* Search */}
      <div className="px-5 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161D2B] border border-white/5 rounded-full py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-mara-pink/50 transition-colors placeholder:text-theme-muted/50"
          />
        </div>
      </div>

      {/* Stories Rail */}
      <div className="px-2 mb-8">
        <div className="flex overflow-x-auto hide-scrollbar gap-4 px-3 pb-2">
          {/* Add Story Button */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <button className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/50 bg-[#161D2B] hover:bg-white/5 transition-colors">
              <span className="text-2xl">+</span>
            </button>
            <span className="text-[10px] font-bold text-theme-muted">Ajouter</span>
          </div>
          
          {stories.map(story => (
            <div key={story.id} onClick={() => navigate('/story')} className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-[#161D2B] text-lg font-bold border-2 border-[#0B0E14] ${story.isUnseen ? 'story-ring-active' : 'opacity-70'}`}>
                {story.pseudo.charAt(0)}
              </div>
              <span className="text-[10px] font-bold text-white/80">{story.pseudo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <main className="px-3 space-y-1 flex-1">
        {conversations.map(conv => (
          <div 
            key={conv.id} 
            onClick={() => conv.isAnonymous ? navigate('/chat') : navigate('/chat')}
            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-[#161D2B]/50 transition-colors cursor-pointer active:scale-[0.98]"
          >
            {/* Avatar */}
            <div className="relative">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${conv.isAnonymous ? 'bg-gradient-to-tr from-mara-pink to-purple-600 blur-[1px]' : 'bg-[#161D2B]'}`}>
                {conv.isAnonymous ? '?' : conv.name.charAt(0)}
              </div>
              {conv.isGroup && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0B0E14] rounded-full flex items-center justify-center border-2 border-[#0B0E14]">
                  <span className="text-[8px]">👥</span>
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-end mb-1">
                <h3 className={`font-extrabold truncate text-base ${conv.unread > 0 ? 'text-white' : 'text-white/90'}`}>{conv.name}</h3>
                <span className={`text-[10px] font-bold ml-2 flex-shrink-0 ${conv.unread > 0 ? 'text-mara-pink' : 'text-theme-muted'}`}>{conv.time}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <p className={`text-sm truncate ${conv.unread > 0 ? 'text-white font-bold' : 'text-theme-muted font-medium'}`}>
                  {conv.lastMessage}
                </p>
                {conv.unread > 0 ? (
                  <div className="w-5 h-5 rounded-full bg-mara-pink text-white flex items-center justify-center text-[10px] font-bold shadow-lg shadow-mara-pink/20">
                    {conv.unread}
                  </div>
                ) : (
                  <ChevronRight className="w-4 h-4 text-theme-muted/50" />
                )}
              </div>
            </div>
          </div>
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
