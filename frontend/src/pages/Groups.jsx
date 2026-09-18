import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, ChevronLeft } from 'lucide-react';
import BottomNav from '../components/BottomNav';

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const res = await fetch('/api/v1/groups/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setGroups(data.groups);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col">
      <header className="px-5 pt-10 pb-4 flex items-center justify-between bg-[#0B0E14]/90 backdrop-blur-md z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">Groupes</h1>
        </div>
        <button className="w-10 h-10 rounded-full bg-mara-pink text-white flex items-center justify-center hover:scale-105 transition-transform">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* List */}
      <main className="px-5 space-y-4 flex-1">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#161D2B]/50 border border-white/5 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="w-1/2 h-4 bg-white/10 rounded-full"></div>
                <div className="w-3/4 h-3 bg-white/5 rounded-full"></div>
              </div>
            </div>
          ))
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-20 space-y-4">
            <div className="w-16 h-16 bg-[#161D2B] rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-theme-muted" />
            </div>
            <p className="text-theme-muted text-sm font-medium">Vous n'avez pas encore de groupes.</p>
            <button className="px-6 py-3 bg-mara-pink rounded-full font-bold text-sm text-white shadow-lg shadow-mara-pink/20 active:scale-95 transition-all">
              Créer un groupe
            </button>
          </div>
        ) : (
          groups.map(group => (
            <div 
              key={group.id} 
              onClick={() => navigate(`/group?id=${group.id}`)}
              className="flex items-center gap-4 p-4 rounded-2xl bg-[#161D2B]/50 hover:bg-[#161D2B] cursor-pointer transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-lg">
                {group.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold">{group.name}</h3>
                <p className="text-sm text-theme-muted">{group.participants_count} membres</p>
              </div>
            </div>
          ))
        )}
      </main>
      
      <BottomNav />
    </div>
  );
}
