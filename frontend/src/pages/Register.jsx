import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();
  const [pseudo, setPseudo] = useState('');
  const [pin, setPin] = useState('');
  const [pseudoStatus, setPseudoStatus] = useState('idle'); // idle, checking, available, taken, invalid
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  useEffect(() => {
    if (pseudo.length < 2) {
      setPseudoStatus('invalid');
      return;
    }
    
    setPseudoStatus('checking');
    const timer = setTimeout(() => {
      fetch(`/api/v1/auth/check-pseudo/?pseudo=${encodeURIComponent(pseudo)}`)
        .then(res => res.json())
        .then(data => {
          if (data.available) setPseudoStatus('available');
          else setPseudoStatus('taken');
        })
        .catch(() => setPseudoStatus('idle'));
    }, 400); // Debounce
    
    return () => clearTimeout(timer);
  }, [pseudo]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (pseudoStatus !== 'available' || pin.length !== 4) return;
    
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, pin_code: pin })
      });
      const data = await res.json();
      
      if (res.ok && data.success !== false) {
        navigate('/discussions');
      } else {
        setErrorMsg(data.error || 'Erreur lors de la création du compte.');
      }
    } catch (err) {
      setErrorMsg('Erreur de connexion au serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col pt-12 pb-8 px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold mb-2">Bienvenue sur MARA</h1>
        <p className="text-theme-muted text-sm">Choisis ton identifiant unique pour commencer.</p>
      </header>

      <form onSubmit={handleRegister} className="flex-1 flex flex-col">
        <div className="space-y-6 flex-1">
          {/* Pseudo Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-theme-muted">Choisis un Pseudo</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted font-bold">@</span>
              <input 
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full bg-[#161D2B] border border-white/10 rounded-2xl py-4 pl-10 pr-12 text-white font-bold outline-none focus:border-mara-pink/50 transition-colors"
                placeholder="pseudo"
                maxLength={20}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {pseudoStatus === 'checking' && <div className="w-4 h-4 border-2 border-theme-muted border-t-mara-pink rounded-full animate-spin"></div>}
                {pseudoStatus === 'available' && <span className="text-green-500">✓</span>}
                {pseudoStatus === 'taken' && <span className="text-red-500">✗</span>}
              </div>
            </div>
            {pseudoStatus === 'available' && <p className="text-xs text-green-400 mt-1">Super ! Ce pseudo est disponible.</p>}
            {pseudoStatus === 'taken' && <p className="text-xs text-red-400 mt-1">Ce pseudo est déjà pris. Essaie @{pseudo}123</p>}
          </div>

          {/* PIN Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-theme-muted">Crée un Code PIN Secret</label>
            <input 
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-[#161D2B] border border-white/10 rounded-2xl py-4 px-4 text-white font-bold outline-none focus:border-mara-pink/50 text-center tracking-[1em] transition-colors"
              placeholder="••••"
            />
          </div>
          
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm font-bold text-center">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto space-y-4 pt-6">
          <button 
            type="submit"
            disabled={pseudoStatus !== 'available' || pin.length !== 4 || isLoading}
            className="w-full bg-mara-pink text-white font-extrabold py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 transition-all flex justify-center items-center h-14"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              'Créer mon compte'
            )}
          </button>
          
          <p className="text-center text-sm text-theme-muted font-medium mt-4">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-mara-pink font-bold hover:underline">
              Se connecter
            </Link>
          </p>

          <div className="relative flex items-center py-2">
            <div className="flex-1 border-t border-white/10"></div>
            <span className="px-3 text-xs text-theme-muted font-semibold">OU</span>
            <div className="flex-1 border-t border-white/10"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="bg-[#161D2B] border border-white/10 hover:bg-white/5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
              <span className="text-xs font-bold">Google</span>
            </button>
            <button type="button" className="bg-[#161D2B] border border-white/10 hover:bg-white/5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-5 h-5" alt="Facebook" />
              <span className="text-xs font-bold">Facebook</span>
            </button>
          </div>
          
        </div>
      </form>
    </div>
  );
}
