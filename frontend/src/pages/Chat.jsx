import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal, Send, Image as ImageIcon, Mic, Square, Play, Loader2 } from 'lucide-react';
import useWebSocket from '../hooks/useWebSocket';
import CustomAudioPlayer from '../components/CustomAudioPlayer';
import CustomVideoPlayer from '../components/CustomVideoPlayer';

export default function Chat() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('id');
  
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const recordingTimer = useRef(null);

  const [myUserId, setMyUserId] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Close context menu on click anywhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const profileRes = await fetch('/api/v1/profile/me/', { headers });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.success) {
            setMyUserId(profileData.user.id);
          }
        }

        const res = await fetch(`/api/v1/conversations/${conversationId}/messages/`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMessages(data.messages);
            setOtherUser(data.other_user);
            scrollToBottom();
          }
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [conversationId]);

  const { isConnected } = useWebSocket(
    conversationId ? `ws://${window.location.host}/ws/chat/${conversationId}/` : null,
    (data) => {
      if (data.type === 'new_message') {
        const incomingMsg = data.message;
        setMessages(prev => {
          if (prev.some(m => m.id === incomingMsg.id)) return prev;
          const formattedMsg = {
            ...incomingMsg,
            is_me: incomingMsg.sender_id === myUserId
          };
          return [...prev, formattedMsg];
        });
        scrollToBottom();
      }
    }
  );

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e, mediaFile = null, mediaType = 'text', duration = 0) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || !conversationId) return;

    const msgText = newMessage.trim();
    if (!mediaFile) setNewMessage('');

    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const formData = new FormData();
      if (msgText) formData.append('text', msgText);
      formData.append('media_type', mediaType);
      
      if (mediaFile) {
        formData.append('media_file', mediaFile);
      }
      if (duration > 0) {
        formData.append('voice_duration', duration);
      }

      if (replyToMsg) {
        formData.append('reply_to_id', replyToMsg.id);
      }

      if (mediaFile || duration > 0) setIsUploading(true);
      
      await fetch(`/api/v1/conversations/${conversationId}/send/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      setReplyToMsg(null);
      if (mediaFile || duration > 0) setIsUploading(false);
      // The websocket will broadcast the message back to us, so we don't manually push it here
    } catch (err) {
      console.error('Error sending message:', err);
      setIsUploading(false);
    }
  };

  const handleMessageAction = async (msgId, action) => {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const res = await fetch('/api/v1/conversations/action/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message_id: msgId, action })
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => prev.filter(m => {
          if (action === 'delete_for_me') return m.id !== msgId;
          return true; // for delete_for_everyone, the socket might not broadcast deletion yet, so we could optimistically update it here if we wanted.
        }));
        if (action === 'delete_for_everyone') {
           setMessages(prev => prev.filter(m => m.id !== msgId));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openContextMenu = (e, msg) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const mediaType = file.type.startsWith('video') ? 'video' : 'image';
      setPreviewMedia({
        file,
        url: URL.createObjectURL(file),
        type: mediaType
      });
      e.target.value = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
      }
      mediaRecorder.current = new MediaRecorder(stream, options);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
        // Send audio
        handleSendMessage(null, audioFile, 'audio', recordingDuration);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        setRecordingDuration(0);
        setIsRecording(false);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("Accès au microphone refusé.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      clearInterval(recordingTimer.current);
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-white">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col relative">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between sticky top-0 bg-[#0B0E14]/90 backdrop-blur-md z-40 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          {otherUser && (
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-1 rounded-xl transition-colors"
              onClick={() => setProfileModal(true)}
            >
              <div className="w-10 h-10 rounded-full bg-[#161D2B] overflow-hidden flex items-center justify-center font-bold text-lg">
                {otherUser.photo ? (
                  <img src={otherUser.photo} alt={otherUser.pseudo} className="w-full h-full object-cover" />
                ) : (
                  otherUser.pseudo.charAt(0).toUpperCase()
                )}
              </div>
              <h1 className="text-lg font-extrabold tracking-tight">
                {otherUser.pseudo}
                {isConnected ? <span className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block"></span> : <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block"></span>}
              </h1>
            </div>
          )}
        </div>
        <button className="w-10 h-10 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <MoreHorizontal className="w-5 h-5 text-white" />
        </button>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4 hide-scrollbar flex flex-col space-y-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-theme-muted text-sm">
            Aucun message. Envoyez un petit mot !
          </div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              onContextMenu={(e) => openContextMenu(e, msg)}
            >
              <div className="max-w-[85%]">
                <div className={`p-3.5 rounded-3xl ${
                  msg.is_me 
                    ? 'bg-mara-pink text-white rounded-br-sm shadow-md shadow-mara-pink/20' 
                    : 'bg-[#161D2B] text-white rounded-bl-sm border border-white/5'
                } ${(!msg.media_url && msg.text && /^[\p{Emoji}\s]+$/u.test(msg.text) && msg.text.trim().length > 0 && Array.from(msg.text.trim()).length <= 5) ? 'bg-transparent shadow-none border-none !p-0' : ''}`}>
                  
                  {/* Reply block */}
                  {msg.reply_to && (
                    <div className="bg-black/20 rounded-xl p-2 mb-2 border-l-4 border-white/50 text-xs text-white/80">
                      <span className="font-bold block mb-1">@{msg.reply_to.sender_pseudo}</span>
                      <p className="line-clamp-2">{msg.reply_to.text || 'Média'}</p>
                    </div>
                  )}

                  {msg.media_type === 'image' && msg.media_url && (
                    <img 
                      src={msg.media_url} 
                      alt="Media" 
                      className="w-full rounded-2xl mb-2 object-cover max-h-64 cursor-pointer"
                      onClick={() => setSelectedMedia({url: msg.media_url, type: 'image'})} 
                    />
                  )}
                  {msg.media_type === 'video' && msg.media_url && (
                    <div 
                      className="relative cursor-pointer mb-2 rounded-2xl overflow-hidden bg-black/20"
                      onClick={() => setSelectedMedia({url: msg.media_url, type: 'video'})}
                    >
                      <video src={msg.media_url} className="w-full max-h-64 object-cover opacity-80" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-xl">
                          <Play className="w-6 h-6 text-white fill-current ml-1" />
                        </div>
                      </div>
                    </div>
                  )}
                  {msg.media_type === 'audio' && msg.media_url && (
                    <div className="min-w-[220px] mb-1">
                      <CustomAudioPlayer src={msg.media_url} isMe={msg.is_me} voiceDuration={msg.voice_duration} />
                    </div>
                  )}
                  {msg.text && (
                    <p className={`font-medium leading-relaxed ${(!msg.media_url && /^[\p{Emoji}\s]+$/u.test(msg.text) && msg.text.trim().length > 0 && Array.from(msg.text.trim()).length <= 5) ? 'text-6xl drop-shadow-lg' : 'text-sm'}`}>
                      {msg.text}
                    </p>
                  )}
                </div>
                <div className={`flex items-center gap-1 mt-1 ${msg.is_me ? 'justify-end' : 'justify-start ml-2'}`}>
                  <span className="text-[10px] text-theme-muted font-bold">{msg.created_at}</span>
                  {msg.is_me && (
                    <span className={`text-[10px] ${msg.status === 'read' ? 'text-blue-400' : 'text-theme-muted'}`}>✓✓</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Uploading indicator */}
        {isUploading && (
          <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%]">
              <div className="p-3.5 rounded-3xl bg-mara-pink text-white rounded-br-sm shadow-md flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-bold opacity-90">Envoi en cours...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Message Input Container */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5 flex flex-col gap-2">
        {/* Reply preview */}
        {replyToMsg && (
          <div className="bg-[#161D2B] rounded-xl p-3 border-l-4 border-mara-pink flex items-center justify-between shadow-lg mx-auto max-w-md w-full relative -mt-10 mb-2">
            <div className="flex-1 overflow-hidden">
              <span className="font-bold text-mara-pink text-xs block mb-1">Réponse à @{replyToMsg.sender_pseudo}</span>
              <p className="text-white/80 text-xs truncate">{replyToMsg.text || 'Média'}</p>
            </div>
            <button onClick={() => setReplyToMsg(null)} className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-md mx-auto relative w-full">
          
          <input 
            type="file" 
            accept="image/*,video/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex-shrink-0 rounded-full bg-[#161D2B] flex items-center justify-center text-theme-muted hover:text-white transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <div className="flex-1 bg-[#161D2B] rounded-full flex items-center border border-white/10 overflow-hidden pr-2 h-12">
            {isRecording ? (
              <div className="flex-1 px-5 flex items-center gap-3 animate-pulse text-mara-pink font-bold text-sm">
                <div className="w-2 h-2 rounded-full bg-mara-pink"></div>
                Enregistrement... {formatDuration(recordingDuration)}
              </div>
            ) : (
              <input 
                type="text" 
                placeholder="Écrire un message..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white px-5 py-3.5 outline-none placeholder:text-theme-muted h-full"
              />
            )}
          </div>
          
          {newMessage.trim() ? (
            <button 
              type="submit"
              className="w-12 h-12 flex-shrink-0 bg-mara-pink rounded-full flex items-center justify-center text-white transition-all active:scale-95"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          ) : isRecording ? (
            <button 
              type="button"
              onClick={stopRecording}
              className="w-12 h-12 flex-shrink-0 bg-red-500 rounded-full flex items-center justify-center text-white transition-all active:scale-95"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button 
              type="button"
              onClick={startRecording}
              className="w-12 h-12 flex-shrink-0 bg-[#161D2B] rounded-full flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-95"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}

        </form>
      </div>

      {/* Media Viewer Overlay */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 right-4 flex gap-4 z-50">
            <a 
              href={selectedMedia.url} 
              download
              target="_blank"
              rel="noreferrer"
              className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </a>
            <button 
              onClick={() => setSelectedMedia(null)}
              className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div className="w-full max-w-4xl max-h-[85vh] h-full flex items-center justify-center">
            {selectedMedia.type === 'video' ? (
              <CustomVideoPlayer src={selectedMedia.url} />
            ) : (
              <img src={selectedMedia.url} alt="Fullscreen" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            )}
          </div>
        </div>
      )}

      {/* Media Preview Modal Before Sending */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-[#0B0E14] flex flex-col animate-in slide-in-from-bottom-2 duration-300">
          <header className="px-4 py-4 flex items-center justify-between border-b border-white/5 bg-[#161D2B]">
            <button onClick={() => setPreviewMedia(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-sm font-bold">Aperçu</h1>
            <div className="w-10"></div>
          </header>
          
          <main className="flex-1 overflow-hidden flex flex-col items-center justify-center p-4 relative">
            <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-black/20">
              {previewMedia.type === 'video' ? (
                <video src={previewMedia.url} controls className="w-full max-h-[60vh] object-cover" />
              ) : (
                <img src={previewMedia.url} alt="Preview" className="w-full max-h-[60vh] object-cover" />
              )}
            </div>
          </main>

          <footer className="p-4 bg-[#161D2B] border-t border-white/5">
            <div className="max-w-xl mx-auto flex gap-2">
              <input 
                type="text"
                placeholder="Ajouter une légende..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-[#0B0E14] border border-white/10 rounded-full px-5 py-3 text-sm text-white focus:outline-none focus:border-mara-pink/50 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(null, previewMedia.file, previewMedia.type);
                    setPreviewMedia(null);
                  }
                }}
              />
              <button 
                onClick={() => {
                  handleSendMessage(null, previewMedia.file, previewMedia.type);
                  setPreviewMedia(null);
                }}
                className="w-12 h-12 rounded-full bg-mara-pink flex items-center justify-center text-white shadow-lg shadow-mara-pink/20 flex-shrink-0"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* Profile Modal */}
      {profileModal && otherUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setProfileModal(false)}>
          <div className="bg-[#161D2B] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="w-24 h-24 mx-auto bg-gradient-to-tr from-mara-pink to-purple-600 rounded-full p-1 mb-4">
              <div className="w-full h-full rounded-full bg-[#0B0E14] flex items-center justify-center overflow-hidden text-3xl font-bold">
                {otherUser.photo ? (
                  <img src={otherUser.photo} className="w-full h-full object-cover" />
                ) : (
                  otherUser.pseudo.charAt(0).toUpperCase()
                )}
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">@{otherUser.pseudo}</h2>
            {otherUser.bio && <p className="text-sm text-theme-muted mb-6">{otherUser.bio}</p>}
            <button 
              onClick={() => setProfileModal(false)}
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-full transition-colors w-full"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#161D2B] border border-white/10 shadow-2xl rounded-2xl py-2 min-w-[150px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 150), left: Math.min(contextMenu.x, window.innerWidth - 160) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 flex items-center gap-2"
            onClick={() => { setReplyToMsg(contextMenu.msg); setContextMenu(null); }}
          >
            Répondre
          </button>
          {contextMenu.msg.media_url && (
            <a 
              href={contextMenu.msg.media_url} 
              download 
              target="_blank"
              rel="noreferrer"
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 flex items-center gap-2"
            >
              Télécharger
            </a>
          )}
          <button 
            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            onClick={() => { handleMessageAction(contextMenu.msg.id, 'delete_for_me'); setContextMenu(null); }}
          >
            Supprimer (Pour moi)
          </button>
          {contextMenu.msg.is_me && (
            <button 
              className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
              onClick={() => { handleMessageAction(contextMenu.msg.id, 'delete_for_everyone'); setContextMenu(null); }}
            >
              Supprimer (Pour tous)
            </button>
          )}
        </div>
      )}

    </div>
  );
}
