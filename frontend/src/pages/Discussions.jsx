import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import useWebSocket from '../hooks/useWebSocket';
import { formatDate } from '../utils/formatDate';

export default function Discussions() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stories, setStories] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [myUserId, setMyUserId] = useState(localStorage.getItem('user_id') || null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const headers = {
          'Authorization': `Bearer ${token}`
        };

        const [profileRes, convRes, storyRes, threadRes] = await Promise.all([
          fetch('/api/v1/profile/me/', { headers }),
          fetch('/api/v1/conversations/', { headers }),
          fetch('/api/v1/stories/rail/', { headers }),
          fetch('/api/v1/threads/', { headers })
        ]);

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.success) {
            setMyUserId(profileData.user.id);
            localStorage.setItem('user_id', profileData.user.id);
          }
        }

        let allConvs = [];

        if (convRes.ok) {
          const convData = await convRes.json();
          if (convData.success) {
            allConvs = [...allConvs, ...convData.conversations.map(c => ({...c, isAnonymous: false}))];
          }
        }

        if (threadRes.ok) {
          const threadData = await threadRes.json();
          if (threadData.success) {
            const threads = threadData.threads.map(t => ({
              id: t.id,
              isAnonymous: true,
              other_user: { pseudo: 'Message anonyme' },
              last_message: { text: t.last_message.text, created_at: t.last_message.created_at },
              unread_count: t.status === 'active' ? 1 : 0
            }));
            allConvs = [...allConvs, ...threads];
          }
        }

        setConversations(allConvs);

        if (storyRes.ok) {
          const storyData = await storyRes.json();
          if (storyData.success) setStories(storyData.stories);
        }
      } catch (err) {
        console.error('Error fetching discussions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // The import useWebSocket was moved to top
  useWebSocket(
    myUserId ? `ws://${window.location.host}/ws/notifications/${myUserId}/` : null,
    (data) => {
      if (data.type === 'conversation_update') {
        const updatedMsg = data.message;
        const convId = data.conversation_id;
        
        setConversations(prev => {
          let updated = [...prev];
          const idx = updated.findIndex(c => c.id === convId);
          if (idx !== -1) {
            updated[idx] = {
              ...updated[idx],
              last_message: {
                text: updatedMsg.text || 'Média partagé',
                created_at: updatedMsg.created_at
              },
              unread_count: updatedMsg.sender_id === myUserId ? updated[idx].unread_count : (updated[idx].unread_count || 0) + 1
            };
            // Move to top
            const [item] = updated.splice(idx, 1);
            updated.unshift(item);
          } else {
            // Need to fetch full conv details if not found (or optionally just push a placeholder)
            // A simple page refresh could be forced here, or we fetch just this conv.
            // For now, let's keep it simple.
          }
          return updated;
        });
      }
    }
  );

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col pb-24 relative overflow-y-auto hide-scrollbar">
      {/* Header */}
      <header className="px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md z-40">
        <h1 className="text-3xl font-extrabold tracking-tight">Discussions</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/notifications')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#161D2B] hover:bg-white/10 transition-colors relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-mara-pink"></div>
          </button>
          <div className="w-10 h-10 rounded-full story-ring-active flex items-center justify-center bg-[#161D2B]">
            <span className="font-bold">{localStorage.getItem('pseudo')?.charAt(0).toUpperCase() || 'A'}</span>
          </div>
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
          <div className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer" onClick={() => navigate('/story/create')}>
            <button className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/50 bg-[#161D2B] hover:bg-white/5 transition-colors pointer-events-none">
              <span className="text-2xl">+</span>
            </button>
            <span className="text-[10px] font-bold text-theme-muted">Ajouter</span>
          </div>
          
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse"></div>
                <div className="w-12 h-2 rounded-full bg-white/10 animate-pulse"></div>
              </div>
            ))
          ) : stories.map(story => {
            const total = story.stories_count || 1;
            const viewed = story.viewed_count || 0;
            const radius = 48;
            const circumference = 2 * Math.PI * radius;
            const gap = total > 1 ? 4 : 0;
            const segmentLength = (circumference - (total * gap)) / total;
            
            return (
              <div key={story.user_id} onClick={() => navigate(`/story?user_id=${story.user_id}`)} className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer">
                <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-[#161D2B] text-lg font-bold">
                  {/* Segmented Ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                    {Array.from({ length: total }).map((_, i) => {
                      const isViewed = i < viewed;
                      const offset = i * (segmentLength + gap);
                      return (
                        <circle
                          key={i}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke={isViewed ? "#333333" : "url(#mara-gradient)"}
                          strokeWidth="4"
                          strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                          strokeDashoffset={-offset}
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <defs>
                      <linearGradient id="mara-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FF4565" />
                        <stop offset="100%" stopColor="#A855F7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  <div className="w-[56px] h-[56px] rounded-full overflow-hidden bg-[#0B0E14] border border-[#0B0E14] flex items-center justify-center z-10">
                    {story.photo ? (
                      <img src={story.photo} alt={story.pseudo} className="w-full h-full object-cover" />
                    ) : (
                      story.pseudo.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-white/80">{story.pseudo}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversations List */}
      <main className="px-3 space-y-1 flex-1">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-2xl">
              <div className="w-14 h-14 rounded-full bg-white/10 animate-pulse flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-4 bg-white/10 rounded-full animate-pulse"></div>
                <div className="w-2/3 h-3 bg-white/5 rounded-full animate-pulse"></div>
              </div>
            </div>
          ))
        ) : (
          conversations.map(conv => {
            const isAnonymous = conv.isAnonymous;
            const name = isAnonymous ? 'Message anonyme' : conv.other_user.pseudo;
            const unread = conv.unread_count || 0;
            const lastMsg = conv.last_message ? conv.last_message.text : 'Aucun message';
            const time = conv.last_message ? formatDate(conv.last_message.created_at) : '';
            
            return (
              <div 
                key={conv.id} 
                onClick={() => navigate(isAnonymous ? `/thread?id=${conv.id}` : `/chat?id=${conv.id}`)}
                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-[#161D2B]/50 transition-colors cursor-pointer active:scale-[0.98]"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${isAnonymous ? 'bg-gradient-to-tr from-mara-pink to-purple-600 blur-[1px]' : 'bg-[#161D2B]'}`}>
                    {isAnonymous ? '?' : name.charAt(0).toUpperCase()}
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-end mb-1">
                    <h3 className={`font-extrabold truncate text-base ${unread > 0 ? 'text-white' : 'text-white/90'}`}>{name}</h3>
                    <span className={`text-[10px] font-bold ml-2 flex-shrink-0 ${unread > 0 ? 'text-mara-pink' : 'text-theme-muted'}`}>{time}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className={`text-sm truncate ${unread > 0 ? 'text-white font-bold' : 'text-theme-muted font-medium'}`}>
                      {lastMsg}
                    </p>
                    {unread > 0 ? (
                      <div className="w-5 h-5 rounded-full bg-mara-pink text-white flex items-center justify-center text-[10px] font-bold shadow-lg shadow-mara-pink/20">
                        {unread}
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-theme-muted/50" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      <BottomNav />
    </div>
  );
}
