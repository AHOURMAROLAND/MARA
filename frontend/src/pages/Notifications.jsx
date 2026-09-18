import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, Heart, MessageCircle } from 'lucide-react';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const res = await fetch('/api/v1/notifications/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setNotifications(data.notifications);
          }
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const markAsRead = async (notifId, targetUrl) => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      await fetch(`/api/v1/notifications/${notifId}/read/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Navigate to the target URL
      if (targetUrl) navigate(targetUrl);
    } catch (err) {
      console.error(err);
      if (targetUrl) navigate(targetUrl);
    }
  };

  const getIcon = (verb) => {
    if (verb === 'story_like') return <Heart className="w-5 h-5 text-mara-pink" />;
    if (verb === 'new_message') return <MessageCircle className="w-5 h-5 text-purple-500" />;
    return <Bell className="w-5 h-5 text-theme-muted" />;
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col">
      <header className="px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md z-40 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 overflow-y-auto hide-scrollbar space-y-2">
        {loading ? (
          <div className="text-center text-theme-muted text-sm mt-10">Chargement...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-20 space-y-4">
            <div className="w-16 h-16 bg-[#161D2B] rounded-full flex items-center justify-center">
              <Bell className="w-8 h-8 text-theme-muted" />
            </div>
            <p className="text-theme-muted text-sm font-medium">Vous n'avez aucune notification.</p>
          </div>
        ) : (
          notifications.filter(notif => notif.verb !== 'new_message').map(notif => (
            <div 
              key={notif.id} 
              onClick={() => markAsRead(notif.id, notif.target_url)}
              className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-colors ${notif.is_read ? 'bg-[#161D2B]/50' : 'bg-[#161D2B] border border-white/10'}`}
            >
              <div className="w-12 h-12 rounded-full bg-[#0B0E14] flex items-center justify-center flex-shrink-0">
                {getIcon(notif.verb)}
              </div>
              <div className="flex-1">
                <h3 className={`text-sm ${notif.is_read ? 'font-medium text-white/80' : 'font-extrabold text-white'}`}>
                  {notif.title}
                </h3>
                {notif.body && <p className="text-[11px] text-theme-muted mt-0.5 line-clamp-1">{notif.body}</p>}
                <p className="text-[10px] text-theme-muted mt-1 font-bold">{notif.created_at}</p>
              </div>
              {!notif.is_read && (
                <div className="w-2 h-2 rounded-full bg-mara-pink flex-shrink-0"></div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
