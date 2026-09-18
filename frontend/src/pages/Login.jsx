import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [pseudo, setPseudo] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (pseudo.length < 2 || pin.length !== 4) return;
    
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/auth/login-pin/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, pin_code: pin })
      });
      const data = await res.json();
      
      if (res.ok && data.success !== false) {
        navigate('/discussions');
      } else {
        setErrorMsg(data.error || 'Identifiants incorrects.');
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
        <h1 className="text-3xl font-extrabold mb-2">Te revoilà ! 👋</h1>
        <p className="text-theme-muted text-sm">Entre ton pseudo et ton PIN pour te reconnecter.</p>
      </header>

      <form onSubmit={handleLogin} className="flex-1 flex flex-col">
        <div className="space-y-6 flex-1">
          {/* Pseudo Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-theme-muted">Ton Pseudo</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted font-bold">@</span>
              <input 
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full bg-[#161D2B] border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white font-bold outline-none focus:border-mara-pink/50 transition-colors"
                placeholder="pseudo"
                maxLength={20}
              />
            </div>
          </div>

          {/* PIN Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-theme-muted">Ton Code PIN</label>
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
            disabled={pseudo.length < 2 || pin.length !== 4 || isLoading}
            className="w-full bg-mara-pink text-white font-extrabold py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 transition-all flex justify-center items-center h-14"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              'Se Connecter'
            )}
          </button>
          
          <p className="text-center text-sm text-theme-muted font-medium mt-4">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-mara-pink font-bold hover:underline">
              S'inscrire
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
