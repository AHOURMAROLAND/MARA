import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal, Send, Image as ImageIcon, Mic, Square, Play, Loader2 } from 'lucide-react';
import useWebSocket from '../hooks/useWebSocket';
import CustomAudioPlayer from '../components/CustomAudioPlayer';
import CustomVideoPlayer from '../components/CustomVideoPlayer';
import { useToast } from '../contexts/ToastContext';
import { formatDate } from '../utils/formatDate';

export default function Chat() {
  const { showToast } = useToast();
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

  const handleReaction = async (msgId, emoji) => {
    // Optimistic UI for reaction
    // ... logic remains
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // add a brief highlight effect
      el.classList.add('bg-white/20');
      setTimeout(() => el.classList.remove('bg-white/20'), 1000);
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
      let options = {};
      
      // Prefer opus on browsers that support it, otherwise let browser use default
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }
      
      mediaRecorder.current = new MediaRecorder(stream, options);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current);
        const mimeType = audioBlob.type || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        
        const audioFile = new File([audioBlob], `audio.${extension}`, { type: mimeType });
        // Send audio
        handleSendMessage(null, audioFile, 'audio', recordingDuration);
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingDuration(0);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      showToast("Accès au microphone refusé.", "error");
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
    return (
      <div className="h-[100dvh] bg-[#0B0E14] text-white flex flex-col relative overflow-hidden">
        {/* Skeleton Header */}
        <header className="px-3 py-2 flex items-center justify-between border-b border-white/5 bg-[#0B0E14]/90 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
            <div className="flex items-center gap-2 p-1">
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
              <div className="w-24 h-4 bg-white/10 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
        </header>

        {/* Skeleton Messages */}
        <main className="flex-1 overflow-hidden px-3 pt-6 flex flex-col gap-6">
          <div className="flex justify-start">
            <div className="w-48 h-12 bg-white/5 rounded-3xl rounded-bl-sm animate-pulse"></div>
          </div>
          <div className="flex justify-end">
            <div className="w-32 h-10 bg-mara-pink/20 rounded-3xl rounded-br-sm animate-pulse"></div>
          </div>
          <div className="flex justify-start">
            <div className="w-64 h-16 bg-white/5 rounded-3xl rounded-bl-sm animate-pulse"></div>
          </div>
        </main>

        {/* Skeleton Input */}
        <div className="p-2 border-t border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-2 max-w-md mx-auto w-full">
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse"></div>
            <div className="flex-1 h-10 bg-white/5 rounded-full animate-pulse"></div>
            <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#0B0E14] text-white flex flex-col relative">
      {/* Header */}
      <header className="px-3 py-2 flex items-center justify-between bg-[#0B0E14]/90 backdrop-blur-md z-40 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          {otherUser && (
            <div 
              className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded-xl transition-colors"
              onClick={() => navigate(`/discussion-profile/${conversationId}`)}
            >
              <div className="w-8 h-8 rounded-full bg-[#161D2B] overflow-hidden flex items-center justify-center font-bold text-sm">
                {otherUser.photo ? (
                  <img src={otherUser.photo} alt={otherUser.pseudo} className="w-full h-full object-cover" />
                ) : (
                  otherUser.pseudo.charAt(0).toUpperCase()
                )}
              </div>
              <h1 className="text-base font-extrabold tracking-tight">
                {otherUser.pseudo}
                {isConnected ? <span className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block"></span> : <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block"></span>}
              </h1>
            </div>
          )}
        </div>
        <button className="w-8 h-8 rounded-full bg-[#161D2B] flex items-center justify-center hover:bg-white/10 transition-colors">
          <MoreHorizontal className="w-5 h-5 text-white" />
        </button>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto px-3 pb-20 pt-2 hide-scrollbar flex flex-col space-y-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-theme-muted text-sm">
            Aucun message. Envoyez un petit mot !
          </div>
        ) : (
          messages.map((msg, index) => {
            const isLast = index === messages.length - 1;
            const isFirstInGroup = index === 0 || messages[index - 1].sender_pseudo !== msg.sender_pseudo;
            
            return (
              <div 
                key={msg.id} 
                id={`msg-${msg.id}`}
                className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'} transition-colors duration-500 rounded-xl`}
              >
                {!msg.is_me && isFirstInGroup && (
                  <div 
                    className="w-8 h-8 rounded-full bg-black/50 overflow-hidden mr-2 mt-auto cursor-pointer flex-shrink-0"
                    onClick={() => navigate(`/discussion-profile/${conversationId}`)}
                  >
                    {otherUser?.photo ? (
                      <img src={otherUser.photo} alt={otherUser.pseudo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold bg-gradient-to-br from-mara-pink to-purple-600">
                        {otherUser?.pseudo?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                {(!msg.is_me && !isFirstInGroup) && <div className="w-10"></div>}

                <div 
                  className={`relative group max-w-[85%] ${!msg.is_me && !isFirstInGroup ? '-mt-4' : ''}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleContextMenu(msg.id);
                  }}
                >
                  <div className={`p-3.5 rounded-3xl ${
                    msg.is_me 
                      ? 'bg-mara-pink text-white rounded-br-sm shadow-md shadow-mara-pink/20' 
                      : 'bg-[#161D2B] text-white rounded-bl-sm border border-white/5'
                  } ${(!msg.media_url && msg.text && /^[\p{Emoji}\s]+$/u.test(msg.text) && msg.text.trim().length > 0 && Array.from(msg.text.trim()).length <= 5) ? 'bg-transparent shadow-none border-none !p-0' : ''}`}>
                    
                    {/* Reply citation */}
                    {msg.reply_to && (
                      <div 
                        onClick={() => scrollToMessage(msg.reply_to.id)}
                        className="bg-black/30 rounded-xl p-2.5 mb-2 text-sm border-l-4 border-mara-pink flex flex-col cursor-pointer hover:bg-black/40 transition-colors active:scale-[0.98]"
                      >
                        <span className="font-extrabold text-mara-pink mb-0.5">@{msg.reply_to.sender_pseudo}</span>
                        <span className="text-white/80 line-clamp-3 leading-snug">{msg.reply_to.text || 'Média partagé'}</span>
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
                  {msg.link_preview && (
                    <a href={msg.link_preview.url} target="_blank" rel="noreferrer" className="block mt-2 rounded-xl overflow-hidden bg-black/40 border border-white/5 hover:bg-black/50 transition-colors">
                      {msg.link_preview.image_url && (
                        <img src={msg.link_preview.image_url} alt="" className="w-full h-32 object-cover" />
                      )}
                      <div className="p-3">
                        <p className="text-[10px] uppercase tracking-wider text-mara-pink font-extrabold mb-1">{msg.link_preview.domain}</p>
                        <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug mb-1">{msg.link_preview.title}</h4>
                        {msg.link_preview.description && (
                          <p className="text-xs text-white/60 line-clamp-2">{msg.link_preview.description}</p>
                        )}
                      </div>
                    </a>
                  )}
                </div>
                <div className={`flex items-center gap-1 mt-1 ${msg.is_me ? 'justify-end' : 'justify-start ml-2'}`}>
                  <span className="text-[10px] text-theme-muted font-bold">{formatDate(msg.created_at)}</span>
                  {msg.is_me && (
                    <span className={`text-[10px] ${msg.status === 'read' ? 'text-blue-400' : 'text-theme-muted'}`}>✓✓</span>
                  )}
                </div>
              </div>
            </div>
          )})
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

        <div ref={messagesEndRef} className="h-4" />
      </main>

      {/* Message Input Container */}
      {(otherUser && (otherUser.am_i_blocked || otherUser.is_blocked_by_me)) ? (
        <div className="p-4 bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5 flex flex-col items-center justify-center text-center flex-shrink-0 relative z-40">
          <p className="text-theme-muted text-sm font-bold">
            {otherUser.is_blocked_by_me ? "Vous avez bloqué cet utilisateur." : "Vous ne pouvez pas envoyer de messages à cet utilisateur."}
          </p>
        </div>
      ) : (
        <div className="p-2 bg-[#0B0E14]/90 backdrop-blur-xl border-t border-white/5 flex flex-col gap-1 flex-shrink-0 relative z-40">
          {/* Reply preview in input */}
          {replyToMsg && (
            <div className="bg-[#161D2B] rounded-xl p-3 border-l-4 border-mara-pink flex items-center justify-between shadow-lg mx-auto max-w-md w-full relative -mt-10 mb-2">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs text-mara-pink font-extrabold mb-1">Réponse à @{replyToMsg.sender_pseudo}</p>
                <p className="text-xs text-white/80 line-clamp-2 leading-snug">{replyToMsg.text || 'Média'}</p>
              </div>
              <button onClick={() => setReplyToMsg(null)} className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <X className="w-4 h-4 text-white/70" />
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
              <ImageIcon className="w-4 h-4" />
            </button>

            <div className="flex-1 bg-[#161D2B] rounded-full flex items-center border border-white/10 overflow-hidden pr-2 h-10">
              {isRecording ? (
                <div className="flex-1 px-4 flex items-center gap-2 animate-pulse text-mara-pink font-bold text-sm">
                  <div className="w-2 h-2 rounded-full bg-mara-pink"></div>
                  Enregistrement... {formatDuration(recordingDuration)}
                </div>
              ) : (
                <input 
                  type="text" 
                  placeholder="Écrire un message..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white px-4 py-2 outline-none placeholder:text-theme-muted h-full"
                />
              )}
            </div>
            
            {newMessage.trim() ? (
              <button 
                type="submit"
                className="w-10 h-10 flex-shrink-0 bg-mara-pink rounded-full flex items-center justify-center text-white transition-all active:scale-95"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : isRecording ? (
              <button 
                type="button"
              onClick={stopRecording}
              className="w-10 h-10 flex-shrink-0 bg-red-500 rounded-full flex items-center justify-center text-white transition-all active:scale-95"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button 
              type="button"
              onClick={startRecording}
              className="w-10 h-10 flex-shrink-0 bg-[#161D2B] rounded-full flex items-center justify-center text-white transition-all hover:bg-white/10 active:scale-95"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

        </form>
      </div>
      )}

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
                className="w-10 h-10 rounded-full bg-mara-pink flex items-center justify-center text-white shadow-lg shadow-mara-pink/20 flex-shrink-0"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#161D2B] border border-white/10 shadow-2xl rounded-xl py-1.5 min-w-[140px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
