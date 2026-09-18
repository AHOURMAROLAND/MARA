import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Flashlight, Share2 } from 'lucide-react';

export default function AddContact() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('search'); // 'search' or 'scan'
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col relative">
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
              onClick={() => setIsDiscoverable(!isDiscoverable)}
              className={`w-10 h-6 rounded-full p-1 transition-colors ${isDiscoverable ? 'bg-mara-pink' : 'bg-[#0B0E14] border border-white/20'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isDiscoverable ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Scanner Area */}
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
        <div className="bg-[#161D2B] rounded-2xl p-4 flex items-center gap-4 mb-8 border border-white/5">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <div className="w-10 h-10 bg-black/10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundPosition: '0 0, 4px 4px', backgroundSize: '8px 8px' }}></div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold text-white">Mon QR code</h3>
            <p className="text-[10px] text-theme-muted">Partagez-le pour que d'autres vous ajoutent</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-[#0B0E14] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results (simulated when typing) */}
      {searchQuery.length > 2 && (
        <div className="absolute bottom-0 left-0 right-0 bg-[#0B0E14] border-t border-white/5 pt-4 pb-10 px-5 z-50 animate-in slide-in-from-bottom-12 duration-300 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
          <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-4">Résultats</h3>
          <div className="bg-[#161D2B] rounded-2xl p-3 flex items-center gap-4 border border-white/5">
            <div className="w-12 h-12 rounded-full story-ring-active flex items-center justify-center bg-black overflow-hidden">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop" alt="nova_23" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-extrabold text-white">@nova_23</h4>
              <p className="text-[10px] text-theme-muted">Aucun ami en commun</p>
            </div>
            <button className="bg-gradient-to-r from-mara-pink to-purple-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl hover:opacity-90 transition-opacity">
              Inviter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
