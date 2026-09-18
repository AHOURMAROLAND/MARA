import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animation trigger
    setTimeout(() => setIsVisible(true), 100);

    // TODO: Verify token in localStorage or cookies
    const token = localStorage.getItem('reconnect_token');
    if (token) {
      // Simulate API check
      setTimeout(() => {
        // navigate('/discussions');
      }, 1500);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-between py-12 px-5">
      <div className="flex-1 flex flex-col justify-center items-center">
        <div 
          className={`w-28 h-28 bg-gradient-to-tr from-mara-pink to-purple-600 rounded-3xl shadow-[0_0_40px_rgba(255,51,102,0.3)] transition-all duration-1000 transform ${isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}
        ></div>
        <h1 className={`mt-8 text-4xl font-extrabold text-white tracking-tight transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          MARA
        </h1>
        <p className={`mt-3 text-theme-muted font-medium text-sm transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          Messagerie Anonyme
        </p>
      </div>

      <div className={`w-full max-w-sm transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} flex flex-col gap-4`}>
        <button 
          onClick={() => navigate('/register')}
          className="w-full bg-mara-pink text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-mara-pink/25 hover:bg-opacity-90 active:scale-[0.98] transition-all"
        >
          Commencer
        </button>
        <button 
          onClick={() => navigate('/login')}
          className="w-full bg-[#161D2B] text-white font-extrabold py-4 rounded-2xl border border-white/10 hover:bg-white/5 active:scale-[0.98] transition-all"
        >
          J'ai déjà un compte
        </button>
      </div>
    </div>
  );
}
