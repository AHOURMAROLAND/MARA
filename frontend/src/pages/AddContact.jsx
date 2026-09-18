import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Flashlight, Share2 } from 'lucide-react';

export default function AddContact() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('search');
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Fetch profile to get link_id for QR code and current discoverability status
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const res = await fetch('/api/v1/profile/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUserProfile(data.user);
            setIsDiscoverable(data.user.is_searchable);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setLoadingSearch(true);
        try {
          const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
          const res = await fetch(`/api/v1/search/users/?q=${encodeURIComponent(searchQuery)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setResults(data.results);
            }
          }
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          setLoadingSearch(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const toggleDiscoverable = async () => {
    const newState = !isDiscoverable;
    setIsDiscoverable(newState);
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      await fetch('/api/v1/profile/update/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_searchable: newState })
      });
    } catch (err) {
      console.error(err);
      setIsDiscoverable(!newState); // revert on error
    }
  };

  const handleInvite = async (userId) => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch('/api/v1/contacts/invite/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setResults(results.map(r => r.id === userId ? { ...r, pending_invitation: true } : r));
      } else {
        alert(data.error || "Erreur d'invitation");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const shareProfile = () => {
    if (!userProfile) return;
    const url = `${window.location.origin}/m/send/${userProfile.link_id}`;
    if (navigator.share) {
      navigator.share({ title: `Ajoute @${userProfile.pseudo} sur MARA`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Lien copié !');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col relative overflow-x-hidden">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between sticky top-0 z-40 bg-[#0B0E14]">
        <h1 className="text-2xl font-extrabold tracking-tight">Ajouter un contact</h1>
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>
      </header>

      {/* Tabs */}
      <div className="px-5 mb-6">
        <div className="bg-[#161D2B] rounded-2xl p-1 flex">
          <button 
            onClick={() => setTab('search')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${tab === 'search' ? 'bg-gradient-to-r from-mara-pink to-purple-600 shadow-lg' : 'text-theme-muted hover:text-white'}`}
          >
            Rechercher un pseudo
          </button>
          <button 
            onClick={() => setTab('scan')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${tab === 'scan' ? 'bg-gradient-to-r from-mara-pink to-purple-600 shadow-lg' : 'text-theme-muted hover:text-white'}`}
          >
            Scanner un QR code
          </button>
        </div>
      </div>

      {/* Search Input & Toggle */}
      {tab === 'search' && (
        <div className="px-5 mb-6">
          <div className="bg-[#161D2B] rounded-2xl p-4 flex items-center justify-between border border-white/5">
            <div className="flex items-center flex-1 gap-2">
              <span className="text-theme-muted font-bold">@</span>
              <input 
                type="text" 
                placeholder="Rechercher un pseudo" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium w-full text-white placeholder:text-theme-muted"
              />
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <span className="text-[10px] font-bold text-white">Être trouvable</span>
              {/* Toggle Switch */}
              <button 
                onClick={toggleDiscoverable}
                className={`w-10 h-6 rounded-full p-1 transition-colors ${isDiscoverable ? 'bg-mara-pink' : 'bg-[#0B0E14] border border-white/20'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isDiscoverable ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Area */}
      {tab === 'scan' && (
        <div className="px-5 flex-1 flex flex-col">
          <div className="flex-1 bg-gradient-to-b from-[#161D2B] to-[#111622] rounded-[2rem] border border-white/5 relative flex flex-col items-center justify-center overflow-hidden mb-6 shadow-2xl">
            {/* Faux Camera Feed background */}
            <div className="absolute inset-0 bg-[#0B0E14]/50 backdrop-blur-[2px]"></div>
            
            {/* Scanner frame */}
            <div className="relative w-48 h-48 flex items-center justify-center z-10 mb-8">
              {/* Corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-mara-pink rounded-tl-xl"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-purple-500 rounded-tr-xl"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-mara-pink rounded-bl-xl"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-purple-500 rounded-br-xl"></div>
              
              <p className="text-center text-xs text-white/80 font-medium px-4">
                Scannez le QR code d'un profil pour l'ajouter
              </p>
            </div>

            <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center z-10 hover:bg-white/20 transition-colors border border-white/10">
              <Flashlight className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Mon QR code card */}
          {userProfile && (
            <div className="bg-[#161D2B] rounded-2xl p-4 flex items-center gap-4 mb-8 border border-white/5">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src={`/api/v1/profile/${userProfile.link_id}/qrcode/`} alt="QR" className="w-full h-full object-cover mix-blend-multiply" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-extrabold text-white">Mon QR code</h3>
                <p className="text-[10px] text-theme-muted">Partagez-le pour que d'autres vous ajoutent</p>
              </div>
              <button onClick={shareProfile} className="w-10 h-10 rounded-full bg-[#0B0E14] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {tab === 'search' && searchQuery.length > 2 && (
        <div className="absolute bottom-0 left-0 right-0 bg-[#0B0E14] border-t border-white/5 pt-4 pb-10 px-5 z-50 animate-in slide-in-from-bottom-12 duration-300 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] h-1/2 overflow-y-auto">
          <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-4">Résultats</h3>
          
          {loadingSearch ? (
            <div className="text-center text-theme-muted text-sm py-4">Recherche...</div>
          ) : results.length === 0 ? (
            <div className="text-center text-theme-muted text-sm py-4">Aucun utilisateur trouvé.</div>
          ) : (
            <div className="space-y-3">
              {results.map(user => (
                <div key={user.id} className="bg-[#161D2B] rounded-2xl p-3 flex items-center gap-4 border border-white/5">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black overflow-hidden font-bold border-2 border-[#0B0E14]">
                    {user.photo ? (
                      <img src={user.photo} alt={user.pseudo} className="w-full h-full object-cover" />
                    ) : (
                      user.pseudo.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-extrabold text-white">@{user.pseudo}</h4>
                    <p className="text-[10px] text-theme-muted truncate max-w-[150px]">{user.bio || "Aucun ami en commun"}</p>
                  </div>
                  
                  {user.is_friend ? (
                    <span className="text-xs text-theme-muted font-bold px-2">Amis</span>
                  ) : user.pending_invitation ? (
                    <span className="text-xs text-mara-pink font-bold px-2">En attente</span>
                  ) : (
                    <button 
                      onClick={() => handleInvite(user.id)}
                      className="bg-gradient-to-r from-mara-pink to-purple-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Inviter
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
