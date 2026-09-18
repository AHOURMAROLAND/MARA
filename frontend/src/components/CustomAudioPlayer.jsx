import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export default function CustomAudioPlayer({ src, isMe, voiceDuration }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(voiceDuration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Dynamic waveform state
  const [waveform, setWaveform] = useState(Array(30).fill(4));

  useEffect(() => {
    if (!src) return;

    const analyzeAudio = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const samples = 30;
        const blockSize = Math.floor(channelData.length / samples);
        
        const peaks = [];
        let maxPeak = 0;

        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
             sum += Math.abs(channelData[start + j]);
          }
          const avg = sum / blockSize;
          peaks.push(avg);
          if (avg > maxPeak) maxPeak = avg;
        }

        // Normalize between 4px and 24px height
        const normalized = peaks.map(p => {
           if (maxPeak === 0) return 4;
           return 4 + (p / maxPeak) * 20;
        });

        setWaveform(normalized);
      } catch (err) {
        console.error("Audio analysis failed:", err);
        // Fallback to random if fetch/decode fails
        setWaveform(Array.from({ length: 30 }, () => 4 + Math.random() * 20));
      }
    };

    analyzeAudio();
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity && !voiceDuration) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [voiceDuration]);

  const togglePlay = () => {
    if (audioRef.current) {
      audioRef.current.muted = false;
      audioRef.current.volume = 1.0;
      audioRef.current.playbackRate = playbackRate;
      
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => console.error('Audio playback failed:', e));
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const cycleSpeed = () => {
    const newRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(newRate);
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = percentage * audioRef.current.duration;
      setProgress(percentage * 100);
    }
  };

  return (
    <div className={`flex items-center gap-3 w-full min-w-[200px] h-10 ${isMe ? 'text-white' : 'text-white'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <button 
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      <div 
        className="flex-1 h-6 flex items-center gap-[2px] cursor-pointer"
        onClick={handleSeek}
      >
        {waveform.map((h, i) => {
          const barPercentage = (i / waveform.length) * 100;
          const isPlayed = barPercentage <= progress;
          
          return (
            <div 
              key={i}
              className={`w-1 rounded-full transition-colors duration-75 ${
                isPlayed 
                  ? (isMe ? 'bg-white' : 'bg-mara-pink') 
                  : (isMe ? 'bg-white/40' : 'bg-white/20')
              }`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      <div className="flex-shrink-0 text-[10px] font-bold opacity-80 min-w-[30px] text-right flex items-center gap-1">
        <button 
          onClick={cycleSpeed}
          className="bg-black/20 hover:bg-black/40 px-1.5 py-0.5 rounded text-[9px] font-extrabold transition-colors"
        >
          {playbackRate}x
        </button>
        <span>{isPlaying ? formatTime(currentTime) : formatTime(duration)}</span>
      </div>
    </div>
  );
}
