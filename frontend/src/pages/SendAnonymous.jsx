import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, Send, Image as ImageIcon, CheckCircle } from 'lucide-react';

export default function SendAnonymous() {
  const navigate = useNavigate();
  const { link_id } = useParams();

  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // In a real app, you would fetch profile details based on link_id
    // to show who you are sending a message to.
    // For now we simulate it.
    setTimeout(() => {
      setProfile({ pseudo: 'Quelqu\'un' }); // We don't reveal their true identity if it's truly anonymous, or maybe we do (usually anonymous apps show the target pseudo)
      setLoading(false);
    }, 500);
  }, [link_id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      // In a real app, call the API to create an anonymous thread
      // For now, we simulate success
      setTimeout(() => {
        setSuccess(true);
        setSending(false);
      }, 1000);
    } catch (err) {
      console.error(err);
      setSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0B0E14] text-white flex items-center justify-center">Chargement...</div>;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">Message envoyé !</h1>
        <p className="text-theme-muted mb-8">Ton message anonyme a été livré avec succès.</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-mara-pink text-white font-bold px-8 py-4 rounded-2xl w-full max-w-sm hover:opacity-90 active:scale-95 transition-all"
        >
          Créer mon compte MARA
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col items-center p-5 relative">
      <div className="w-full max-w-md flex flex-col items-center mt-12 mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-mara-pink to-purple-600 p-1 mb-4 shadow-[0_0_30px_rgba(255,51,102,0.3)]">
          <div className="w-full h-full bg-[#161D2B] rounded-full flex items-center justify-center text-3xl font-extrabold">
            {profile?.pseudo.charAt(0).toUpperCase()}
          </div>
        </div>
        <h1 className="text-xl font-extrabold">@{profile?.pseudo}</h1>
        <p className="text-sm text-theme-muted mt-1 text-center px-4">
          Envoie-moi un message anonyme ! Je ne saurai pas qui tu es.
        </p>
      </div>

      <div className="w-full max-w-md bg-[#161D2B] rounded-3xl p-5 border border-white/5 relative shadow-xl">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0B0E14] border border-white/10 px-4 py-1 rounded-full flex items-center gap-2 shadow-lg">
          <Shield className="w-3 h-3 text-mara-pink" />
          <span className="text-[10px] font-bold text-white tracking-wide">100% ANONYME</span>
        </div>

        <form onSubmit={handleSend} className="mt-4 flex flex-col gap-4">
          <textarea
            placeholder="Écris ton message ici..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/5 rounded-2xl p-4 text-sm text-white placeholder:text-theme-muted outline-none focus:border-mara-pink/50 transition-colors resize-none h-32"
          ></textarea>
          
          <div className="flex items-center justify-between">
            <button type="button" className="w-10 h-10 rounded-full bg-[#0B0E14] border border-white/5 flex items-center justify-center text-theme-muted hover:text-white transition-colors">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button 
              type="submit"
              disabled={!message.trim() || sending}
              className="bg-mara-pink text-white font-extrabold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-mara-pink/20 disabled:opacity-50 disabled:shadow-none hover:bg-opacity-90 transition-all active:scale-95"
            >
              {sending ? 'Envoi...' : 'Envoyer secrètement'} <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
