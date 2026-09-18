import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Image as ImageIcon, Type, Send, Mic, Square } from 'lucide-react';

export default function CreateStory() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('image'); // image, text, audio

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const recordingTimer = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setMode('image');
    }
  };

  const startRecording = async () => {
    try {
      setMode('audio');
      setFile(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setFile(audioBlob);
        setPreview(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        clearInterval(recordingTimer.current);
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
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('reconnect_token');
      const formData = new FormData();
      
      formData.append('media_type', mode);
      if (text) formData.append('text_content', text);
      
      if ((mode === 'image' || mode === 'audio') && file) {
        formData.append('media_file', file, mode === 'audio' ? 'audio.webm' : undefined);
      } else if (mode === 'image' && !file) {
        alert("Veuillez sélectionner une image.");
        setLoading(false);
        return;
      } else if (mode === 'audio' && !file) {
        alert("Veuillez enregistrer un vocal.");
        setLoading(false);
        return;
      }

      const res = await fetch('/api/v1/stories/create/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        navigate(-1);
      } else {
        alert(data.error || "Erreur lors de la création de la story");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0E14] text-white flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-sm font-bold shadow-black drop-shadow-md">Nouvelle Story</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center mt-16 px-4">
        {mode === 'image' && preview ? (
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative">
            <img src={preview} alt="Preview" className="w-full h-full object-cover max-h-[60vh]" />
            <input 
              type="text"
              placeholder="Ajouter un texte..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-xl outline-none placeholder:text-white/70"
            />
          </div>
        ) : mode === 'text' ? (
          <div className="w-full h-[60vh] max-w-sm rounded-3xl bg-gradient-to-br from-mara-pink to-purple-600 flex flex-col items-center justify-center p-6 shadow-2xl relative">
            <textarea
              placeholder="Exprimez-vous..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-full bg-transparent text-center text-3xl font-extrabold text-white outline-none resize-none placeholder:text-white/50 flex items-center justify-center pt-24"
            />
          </div>
        ) : mode === 'audio' ? (
          <div className="w-full h-[60vh] max-w-sm rounded-3xl bg-gradient-to-tr from-purple-800 to-indigo-900 flex flex-col items-center justify-center p-6 shadow-2xl relative">
            {isRecording ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-mara-pink/20 flex items-center justify-center animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-mara-pink flex items-center justify-center">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                </div>
                <span className="text-2xl font-bold">{formatDuration(recordingDuration)}</span>
                <button onClick={stopRecording} className="mt-4 px-6 py-2 bg-white/20 rounded-full font-bold">
                  Arrêter l'enregistrement
                </button>
              </div>
            ) : preview ? (
              <div className="flex flex-col items-center w-full gap-6">
                <audio src={preview} controls className="w-full" />
                <input 
                  type="text"
                  placeholder="Légende audio..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-xl outline-none placeholder:text-white/70"
                />
              </div>
            ) : (
              <div className="text-center">Prêt à enregistrer</div>
            )}
          </div>
        ) : (
          <div className="text-center text-theme-muted">
            <p>Sélectionnez un type de story en bas.</p>
          </div>
        )}
      </main>

      <footer className="p-6 bg-[#0B0E14] flex items-center justify-between">
        <div className="flex gap-4">
          <input 
            type="file" 
            accept="image/*,video/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${mode === 'image' && preview ? 'bg-mara-pink text-white' : 'bg-[#161D2B] text-white hover:bg-white/10'}`}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={() => { setMode('text'); setFile(null); setPreview(''); }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${mode === 'text' ? 'bg-mara-pink text-white' : 'bg-[#161D2B] text-white hover:bg-white/10'}`}
          >
            <Type className="w-5 h-5" />
          </button>
          <button 
            onClick={() => isRecording ? stopRecording() : startRecording()}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${mode === 'audio' ? 'bg-mara-pink text-white' : 'bg-[#161D2B] text-white hover:bg-white/10'} ${isRecording ? 'animate-pulse bg-red-500' : ''}`}
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>

        <button 
          onClick={handlePublish}
          disabled={loading || (mode === 'image' && !preview) || (mode === 'text' && !text.trim()) || (mode === 'audio' && !preview)}
          className="bg-white text-black font-extrabold px-6 py-3 rounded-full flex items-center gap-2 hover:bg-gray-200 disabled:opacity-50 disabled:bg-[#161D2B] disabled:text-white transition-colors"
        >
          {loading ? 'Publication...' : 'Publier'} <Send className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
