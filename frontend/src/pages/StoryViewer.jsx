import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Heart, Send } from 'lucide-react';

export default function StoryViewer() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  // Simulate story progress
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          // Navigate back when story finishes
          setTimeout(() => navigate(-1), 200);
          return 100;
        }
        return p + 1;
      });
    }, 50); // 5 seconds total (100 * 50ms)
    
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {/* Background Image (Simulated Story Content) */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?q=80&w=1000&auto=format&fit=crop)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"></div>
      </div>

      {/* Progress Bars */}
      <div className="relative z-10 pt-12 px-4 flex gap-1">
        <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
          <div className="h-full bg-white rounded-full" style={{ width: '100%' }}></div>
        </div>
        <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
          <div className="h-full bg-gradient-to-r from-mara-pink to-purple-500 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full story-ring-active flex items-center justify-center bg-black/50 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop" alt="Yuna" className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm drop-shadow-md">Yuna</h3>
            <p className="text-[10px] text-white/80 font-bold drop-shadow-md">il y a 2h</p>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/40 transition-colors">
          <X className="w-5 h-5 text-white drop-shadow-md" />
        </button>
      </div>

      {/* Empty space for gestures */}
      <div className="flex-1 relative z-10" onClick={() => setProgress(100)}>
        {/* Click to skip logic could go here */}
      </div>

      {/* Bottom Action Area */}
      <div className="relative z-10 px-4 pb-8 pt-4 flex items-center gap-3 animate-in slide-in-from-bottom-8 duration-500">
        <button 
          onClick={() => setIsLiked(!isLiked)}
          className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${isLiked ? 'bg-mara-pink text-white shadow-[0_0_20px_rgba(255,51,102,0.5)]' : 'bg-black/40 text-white border border-white/20'}`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
        </button>
        
        <div className="flex-1 bg-black/40 backdrop-blur-md rounded-full flex items-center border border-white/20 pr-1.5 focus-within:border-white/50 transition-colors">
          <input 
            type="text" 
            placeholder="Répondre à Yuna..." 
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white px-5 py-3 outline-none placeholder:text-white/60"
          />
          {reply && (
            <button className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform">
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
