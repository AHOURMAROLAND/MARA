import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Heart, Send, Eye, Users } from 'lucide-react';

export default function StoryViewer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user_id');

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  
  const myUserId = localStorage.getItem('user_id');

  useEffect(() => {
    if (!userId) {
      navigate(-1);
      return;
    }
    const fetchStories = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const res = await fetch(`/api/v1/stories/user/${userId}/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
            setStories(data.stories);
            if (data.stories.length > 0) {
              setIsLiked(data.stories[0].liked);
              markViewed(data.stories[0].id);
            } else {
              navigate(-1);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching stories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [userId, navigate]);

  const markViewed = async (storyId) => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      await fetch(`/api/v1/stories/${storyId}/view/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {}
  };

  const nextStory = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      setIsLiked(stories[currentIndex + 1].liked);
      markViewed(stories[currentIndex + 1].id);
    } else {
      navigate(-1);
    }
  }, [currentIndex, stories, navigate]);

  const prevStory = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
      setIsLiked(stories[currentIndex - 1].liked);
    } else {
      setProgress(0);
    }
  }, [currentIndex, stories]);

  // Simulate story progress
  useEffect(() => {
    if (loading || stories.length === 0 || isPaused) return;

    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          nextStory();
          return 0;
        }
        return p + 1; // 1% per 50ms = 5s total
      });
    }, 50);
    
    return () => clearInterval(timer);
  }, [loading, stories.length, isPaused, nextStory]);

  const handleInteract = async (type, text = '') => {
    const currentStory = stories[currentIndex];
    if (!currentStory) return;

    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/stories/${currentStory.id}/react/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, text })
      });
      const data = await res.json();
      if (data.success && type === 'like') {
        setIsLiked(data.liked);
        const newStories = [...stories];
        newStories[currentIndex].liked = data.liked;
        setStories(newStories);
      } else if (data.success && type === 'reply') {
        setReply('');
        // Optional: show a toast
      }
    } catch (e) {
      console.error('Interact error:', e);
    }
  };

  const handleScreenClick = (e) => {
    // Prevent if clicking on input or buttons or if viewers modal is open
    if (e.target.closest('button') || e.target.closest('input') || showViewers) return;

    const screenWidth = window.innerWidth;
    if (e.clientX < screenWidth / 3) {
      prevStory();
    } else {
      nextStory();
    }
  };

  const fetchViewers = async (storyId) => {
    setLoadingViewers(true);
    setShowViewers(true);
    setIsPaused(true);
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/stories/${storyId}/viewers/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setViewers(data.viewers);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingViewers(false);
    }
  };

  if (loading || !user || stories.length === 0) {
    return <div className="fixed inset-0 z-50 bg-black text-white flex items-center justify-center">Chargement...</div>;
  }

  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {/* Background Content */}
      <div 
        className="absolute inset-0 flex items-center justify-center bg-[#0B0E14]"
        style={(!currentStory.media_url || currentStory.media_type === 'audio') ? { background: currentStory.bg_gradient || '#0B0E14' } : {}}
      >
        {currentStory.media_url && currentStory.media_type !== 'audio' && (
          <img 
            src={currentStory.media_url} 
            className="w-full h-full object-contain" 
            alt="Story"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>
        {currentStory.media_type === 'audio' && currentStory.media_url && (
          <div className="z-20 w-3/4 mx-auto mb-8 bg-black/40 p-4 rounded-3xl backdrop-blur-md">
            <audio src={currentStory.media_url} controls className="w-full" autoPlay />
          </div>
        )}

        {currentStory.media_type === 'text' && currentStory.text_content && (
          <p 
            className="z-20 text-3xl font-extrabold px-6 text-center whitespace-pre-wrap pointer-events-none drop-shadow-lg"
            style={{ color: currentStory.text_color || '#FFFFFF' }}
          >
            {currentStory.text_content}
          </p>
        )}
      </div>

      {currentStory.media_type !== 'text' && currentStory.text_content && (
        <div className="absolute bottom-24 left-0 right-0 z-20 pointer-events-none flex justify-center pb-4">
          <p 
            className="text-lg font-bold px-6 text-center whitespace-pre-wrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
            style={{ color: currentStory.text_color || '#FFFFFF' }}
          >
            {currentStory.text_content}
          </p>
        </div>
      )}

      {/* Progress Bars */}
      <div className="relative z-20 pt-12 px-4 flex gap-1 pointer-events-none">
        {stories.map((s, idx) => (
          <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full bg-white rounded-full transition-all duration-75" 
              style={{ 
                width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                background: idx === currentIndex ? 'linear-gradient(to right, #FF4565, #A855F7)' : '#FFFFFF'
              }}
            ></div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="relative z-20 px-4 mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50 overflow-hidden border border-white/20">
            {user.photo ? (
              <img src={user.photo} alt={user.pseudo} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold">{user.pseudo.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h3 className="font-extrabold text-sm drop-shadow-md text-white">{user.pseudo}</h3>
            <p className="text-[10px] text-white/80 font-bold drop-shadow-md">
              {new Date(currentStory.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/40 transition-colors z-30">
          <X className="w-5 h-5 text-white drop-shadow-md" />
        </button>
      </div>

      {/* Gesture Area */}
      <div 
        className="flex-1 relative z-10" 
        onClick={handleScreenClick}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onMouseLeave={() => setIsPaused(false)}
      >
      </div>

      {/* Bottom Action Area */}
      {myUserId === user.id ? (
        <div className="relative z-30 px-4 pb-8 pt-4 flex flex-col items-center animate-in slide-in-from-bottom-8 duration-500">
          <button 
            onClick={() => fetchViewers(currentStory.id)}
            className="flex flex-col items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <Eye className="w-6 h-6 mb-1 drop-shadow-md" />
            <span className="text-xs font-bold drop-shadow-md">{currentStory.views_count} vues</span>
          </button>
        </div>
      ) : (
        <div className="relative z-30 px-4 pb-8 pt-4 flex items-center gap-3 animate-in slide-in-from-bottom-8 duration-500">
          <button 
            onClick={() => handleInteract('like')}
            className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${isLiked ? 'bg-mara-pink text-white shadow-[0_0_20px_rgba(255,51,102,0.5)]' : 'bg-black/40 text-white border border-white/20 hover:bg-black/60'}`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          
          <div className="flex-1 bg-black/40 backdrop-blur-md rounded-full flex items-center border border-white/20 pr-1.5 focus-within:border-white/50 transition-colors">
            <input 
              type="text" 
              placeholder={`Répondre à ${user.pseudo}...`} 
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              className="flex-1 bg-transparent text-sm text-white px-5 py-3 outline-none placeholder:text-white/60"
            />
            {reply && (
              <button 
                onClick={() => handleInteract('reply', reply)}
                className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Viewers Modal */}
      {showViewers && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#161D2B] rounded-t-3xl h-[60vh] flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Eye className="w-5 h-5" />
                <h3 className="font-extrabold text-lg">{currentStory.views_count} Vues</h3>
              </div>
              <button 
                onClick={() => { setShowViewers(false); setIsPaused(false); }}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {loadingViewers ? (
                <div className="text-center text-theme-muted py-10">Chargement...</div>
              ) : viewers.length === 0 ? (
                <div className="text-center text-theme-muted py-10 flex flex-col items-center gap-2">
                  <Users className="w-10 h-10 opacity-20" />
                  <p>Aucune vue pour l'instant</p>
                </div>
              ) : (
                viewers.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-black/50 overflow-hidden">
                        {v.photo ? (
                          <img src={v.photo} alt={v.pseudo} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-mara-pink to-purple-600">
                            {v.pseudo.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{v.pseudo}</p>
                        <p className="text-[10px] text-theme-muted">{new Date(v.viewed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                    {v.liked && (
                      <Heart className="w-5 h-5 text-mara-pink fill-current drop-shadow-[0_0_10px_rgba(255,51,102,0.8)]" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
