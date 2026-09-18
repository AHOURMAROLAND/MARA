import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal, Lock, Send } from 'lucide-react';

export default function ThreadChat() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  const chatMessages = [
    { id: 1, isMine: false, text: "Quelqu'un pense à toi depuis un moment... 👀", time: "09:37" },
    { id: 2, isMine: true, text: "Ah ouais ?? qui es-tu 😳", time: "09:39", read: true },
    { id: 3, isMine: false, text: "Bientôt peut-être 😉", time: "09:40" },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col relative">
      {/* Header */}
      <header className="px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md z-40">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Fil anonyme</h1>
        <button className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <MoreHorizontal className="w-5 h-5 text-white" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-32 hide-scrollbar flex flex-col">
        {/* Thread Info */}
        <div className="flex flex-col items-center mt-6 mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-mara-pink to-purple-600 blur-[2px] mb-4 flex items-center justify-center shadow-[0_0_30px_rgba(255,69,101,0.3)]">
            <div className="w-[90%] h-[90%] bg-[#0B0E14]/50 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-4xl opacity-50">👤</span>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-white mb-1">Message anonyme</h2>
          <p className="text-xs text-theme-muted max-w-[250px] leading-relaxed">
            Quelqu'un t'a envoyé un message sans révéler son identité
          </p>
        </div>

        {/* Messages */}
        <div className="text-center mb-6">
          <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Aujourd'hui</span>
        </div>

        <div className="space-y-4 flex-1">
          {chatMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              {!msg.isMine && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-mara-pink to-purple-600 blur-[1px] mr-2 flex-shrink-0 flex items-center justify-center self-end mb-1">
                  <span className="text-xs opacity-50">👤</span>
                </div>
              )}
              
              <div className="max-w-[75%]">
                <div className={`p-4 rounded-3xl ${
                  msg.isMine 
                    ? 'bg-gradient-to-br from-[#FF4565] to-[#FF8038] text-white rounded-br-sm shadow-lg shadow-mara-pink/20' 
                    : 'bg-[#161D2B] text-white rounded-bl-sm border border-white/5'
                }`}>
                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                </div>
                <div className={`flex items-center gap-1 mt-1 ${msg.isMine ? 'justify-end' : 'justify-start ml-2'}`}>
                  <span className="text-[10px] text-theme-muted font-bold">{msg.time}</span>
                  {msg.isMine && (
                    <span className={`text-[10px] ${msg.read ? 'text-blue-400' : 'text-theme-muted'}`}>✓✓</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Safety Banner & Actions */}
        <div className="mt-8 mb-4 space-y-4">
          <div className="bg-[#161D2B] border border-white/5 rounded-xl py-3 px-4 flex items-center justify-center gap-3">
            <Lock className="w-4 h-4 text-mara-pink" />
            <span className="text-[10px] font-bold text-white/80">Ton identité reste secrète tant que tu ne révèles rien</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="bg-gradient-to-r from-[#FF4565] to-[#FF8038] text-white py-4 rounded-2xl text-sm font-extrabold shadow-lg shadow-mara-pink/25 hover:opacity-90 transition-opacity">
              Découvrir qui c'est
            </button>
            <button className="bg-[#161D2B] border border-white/10 text-white py-4 rounded-2xl text-sm font-extrabold hover:bg-white/5 transition-colors">
              Clore la discussion
            </button>
          </div>
        </div>
      </main>

      {/* Message Input Container */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <div className="flex-1 bg-[#161D2B] rounded-full flex items-center border border-white/10 overflow-hidden pr-2">
            <input 
              type="text" 
              placeholder="Écrire un message..." 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white px-5 py-3.5 outline-none placeholder:text-theme-muted"
            />
          </div>
          <button 
            className="w-12 h-12 flex-shrink-0 bg-[#161D2B] rounded-full flex items-center justify-center text-white/80 border border-white/10 hover:text-white transition-colors"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
