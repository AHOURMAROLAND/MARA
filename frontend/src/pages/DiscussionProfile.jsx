import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Slash, Image, Video, Music, Calendar } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { formatDate } from '../utils/formatDate';

export default function DiscussionProfile() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [mediaList, setMediaList] = useState([]);
  const [otherUser, setOtherUser] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [conversationId]);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/conversations/${conversationId}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.conversation);
        setOtherUser(data.other_user);
        setMediaList(data.media_list);
      } else {
        showToast("Erreur lors du chargement du profil.", "error");
        navigate(-1);
      }
    } catch (err) {
      showToast("Erreur de connexion.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async () => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/users/${otherUser.id}/block/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setOtherUser(prev => ({ ...prev, is_blocked_by_me: data.is_blocked_by_me }));
        showToast(data.message, "success");
      }
    } catch (e) {
      showToast("Erreur lors de l'action de blocage.", "error");
    }
  };

  const deleteConversation = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir effacer tous les messages de cette conversation pour vous ?")) return;
    
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch(`/api/v1/conversations/${conversationId}/delete/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, "success");
        navigate('/discussions');
      }
    } catch (e) {
      showToast("Erreur lors de la suppression.", "error");
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0B0E14] text-white flex flex-col items-center pt-20">
        <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse mb-6"></div>
        <div className="w-48 h-8 rounded-full bg-white/10 animate-pulse"></div>
      </div>
    );
  }

  if (!otherUser) return null;

  return (
    <div className="h-[100dvh] bg-[#0B0E14] text-white flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="px-3 py-4 flex items-center justify-between border-b border-white/5 bg-[#0B0E14]/90 z-40 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="font-extrabold text-lg tracking-tight">Profil de discussion</h1>
        <div className="w-10 h-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar pb-20">
        {/* User Info */}
        <div className="flex flex-col items-center mt-8 px-6">
          <div className="w-32 h-32 rounded-full bg-[#161D2B] mb-4 border-4 overflow-hidden" style={{ borderColor: otherUser.theme_color || '#A855F7' }}>
            {otherUser.photo ? (
              <img src={otherUser.photo} alt={otherUser.pseudo} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-bold bg-gradient-to-br from-mara-pink to-purple-600">
                {otherUser.pseudo.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="text-3xl font-black mb-1">{otherUser.pseudo}</h2>
          {otherUser.bio && <p className="text-theme-muted text-sm text-center mb-4 px-4">{otherUser.bio}</p>}
          
          <div className="flex items-center gap-2 text-theme-muted text-xs bg-white/5 px-4 py-2 rounded-full mt-2">
            <Calendar className="w-4 h-4" />
            <span>Discussion commencée le {formatDate(profile.created_at)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mt-10 px-6">
          <button 
            onClick={toggleBlock}
            className={`flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold transition-all active:scale-95 ${
              otherUser.is_blocked_by_me 
              ? 'bg-white/10 text-white hover:bg-white/20' 
              : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
            }`}
          >
            <Slash className="w-5 h-5" />
            {otherUser.is_blocked_by_me ? 'Débloquer cet utilisateur' : 'Bloquer cet utilisateur'}
          </button>
          
          <button 
            onClick={deleteConversation}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold bg-white/5 text-white/80 hover:bg-white/10 transition-all active:scale-95"
          >
            Effacer la conversation
          </button>
        </div>

        {/* Media List */}
        <div className="mt-10 mb-10">
          <h3 className="px-6 font-bold text-lg mb-4">Médias partagés ({mediaList.length})</h3>
          
          {mediaList.length === 0 ? (
            <div className="text-center text-theme-muted py-8 text-sm">Aucun média échangé.</div>
          ) : (
            <div className="flex overflow-x-auto hide-scrollbar gap-3 px-6 pb-4">
              {mediaList.map(media => (
                <div key={media.id} className="w-32 h-40 rounded-2xl bg-[#161D2B] flex-shrink-0 relative overflow-hidden group">
                  {media.media_type === 'image' ? (
                    <img src={media.media_url} className="w-full h-full object-cover" alt="Media" />
                  ) : media.media_type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <Video className="w-8 h-8 text-white/50" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50">
                      <Music className="w-8 h-8 text-white/50" />
                    </div>
                  )}
                  
                  {/* Media Type Icon indicator */}
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center">
                    {media.media_type === 'image' && <Image className="w-3 h-3 text-white" />}
                    {media.media_type === 'video' && <Video className="w-3 h-3 text-white" />}
                    {media.media_type === 'audio' && <Music className="w-3 h-3 text-white" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
