import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Settings, QrCode, LogOut, Mail } from 'lucide-react';
import BottomNav from '../components/BottomNav';

export default function ProfileMe() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const res = await fetch('/api/v1/profile/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
          }
        } else if (res.status === 401) {
          navigate('/login');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  const shareProfile = () => {
    if (!user) return;
    const url = `${window.location.origin}/m/send/${user.link_id}`;
    if (navigator.share) {
      navigator.share({
        title: `Profil de @${user.pseudo} sur MARA`,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Lien copié !');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-white">Chargement...</div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center text-white p-4 text-center">
      <p className="mb-4">Impossible de charger le profil.</p>
      <button onClick={handleLogout} className="bg-mara-pink px-6 py-2 rounded-xl font-bold">Se reconnecter</button>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col pb-24">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-8 pb-4 border-b border-white/5">
        <button onClick={() => navigate('/discussions')} className="w-10 h-10 rounded-full bg-[#161D2B] border border-white/10 flex items-center justify-center hover:text-white text-white/80 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-extrabold text-white">Mon Profil</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => alert('Les paramètres seront disponibles bientôt !')} className="w-10 h-10 rounded-full bg-[#161D2B] border border-white/10 flex items-center justify-center text-theme-muted hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-[#161D2B] border border-white/10 flex items-center justify-center text-theme-muted hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-6 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-gradient-to-b from-[#161D2B] to-[#111622] border border-white/10 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-mara-pink/20 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="story-ring-active mb-3 mx-auto w-fit">
            {user.photo ? (
              <img src={user.photo} className="w-20 h-20 rounded-full object-cover border-2 border-[#0B0E14]" alt="Avatar" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#161D2B] border-2 border-[#0B0E14] flex items-center justify-center text-white text-3xl font-extrabold">
                {user.pseudo.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-white">@{user.pseudo}</h2>
          {user.bio && <p className="text-xs text-theme-muted mt-1">{user.bio}</p>}
          
          <div className="mt-5 grid grid-cols-2 gap-4">
            <button className="bg-[#0B0E14] border border-white/5 rounded-2xl py-3 flex flex-col items-center justify-center gap-1 hover:border-white/20 transition-all cursor-default">
              <span className="text-lg font-extrabold text-white">{user.stats.friends_count}</span>
              <span className="text-[10px] text-theme-muted uppercase tracking-wider font-bold">Amis</span>
            </button>
            <button className="bg-[#0B0E14] border border-white/5 rounded-2xl py-3 flex flex-col items-center justify-center gap-1 hover:border-white/20 transition-all cursor-default">
              <span className="text-lg font-extrabold text-mara-pink">{user.stats.stories_count}</span>
              <span className="text-[10px] text-theme-muted uppercase tracking-wider font-bold">Stories</span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/qr')} className="btn-dark py-3 rounded-2xl text-xs font-bold gap-1.5 hover:border-white/30 flex items-center justify-center text-mara-pink border-mara-pink/30 hover:bg-mara-pink/10">
              <QrCode className="w-4 h-4" />
              <span>QR Code</span>
            </button>
            <button onClick={shareProfile} className="btn-dark py-3 rounded-2xl text-xs font-bold gap-1.5 hover:border-white/30 flex items-center justify-center bg-[#161D2B] border border-white/10">
              <Share2 className="w-4 h-4 text-theme-muted" />
              <span>Partager</span>
            </button>
          </div>
        </div>

        {/* Anonymous Link Box */}
        <div className="bg-[#111622] border border-white/10 rounded-3xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-mara-pink to-purple-600 flex items-center justify-center text-white shadow-lg">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Lien Anonyme</h3>
              <p className="text-[11px] text-theme-muted">Partage ce lien pour recevoir des messages</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={`${window.location.origin}/m/send/${user.link_id}`}
              readOnly
              className="flex-1 bg-[#161D2B] border border-white/10 rounded-xl px-3.5 py-2.5 text-[11px] text-white font-mono outline-none"
            />
            <button onClick={shareProfile} className="bg-white text-black px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">
              Copier
            </button>
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  );
}
