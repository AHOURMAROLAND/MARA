import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Heart, Send } from 'lucide-react';

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
    // Prevent if clicking on input or buttons
    if (e.target.closest('button') || e.target.closest('input')) return;

    const screenWidth = window.innerWidth;
    if (e.clientX < screenWidth / 3) {
      prevStory();
    } else {
      nextStory();
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
        className="absolute inset-0 bg-cover bg-center opacity-90 flex items-center justify-center"
        style={currentStory.media_url && currentStory.media_type !== 'audio' ? { 
          backgroundImage: `url(${currentStory.media_url})` 
        } : { 
          background: currentStory.bg_gradient || '#0B0E14' 
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>
        {currentStory.media_type === 'audio' && currentStory.media_url && (
          <div className="z-20 w-3/4 mx-auto mb-8 bg-black/40 p-4 rounded-3xl backdrop-blur-md">
            <audio src={currentStory.media_url} controls className="w-full" autoPlay />
          </div>
        )}
        {currentStory.text_content && (
          <p 
            className="z-10 text-3xl font-extrabold px-6 text-center whitespace-pre-wrap pointer-events-none drop-shadow-lg"
            style={{ color: currentStory.text_color || '#FFFFFF' }}
          >
            {currentStory.text_content}
          </p>
        )}
      </div>

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
    </div>
  );
}
