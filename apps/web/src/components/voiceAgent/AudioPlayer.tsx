import React, { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';

interface AudioPlayerProps {
  sessionId: string;
  onError?: (error: string) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ sessionId, onError }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRecording, setHasRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setHasRecording(false);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    checkRecordingExists();
  }, [sessionId]);

  const checkRecordingExists = async () => {
    setIsLoading(true);
    setError(null);
    console.log(`🎧 AudioPlayer: Checking recording for session ${sessionId}`);
    try {
      const response = await fetch(`/api/recordings/${sessionId}`);
      console.log(`🎧 AudioPlayer: Response status ${response.status} for session ${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`🎧 AudioPlayer: Recording data for ${sessionId}:`, data);
        if (data.recording && data.recording.chunks && data.recording.chunks.length > 0) {
          console.log(`🎧 AudioPlayer: Found ${data.recording.chunks.length} chunks for ${sessionId}`);
          setHasRecording(true);
        } else {
          console.log(`🎧 AudioPlayer: No chunks found for ${sessionId}`);
          setHasRecording(false);
        }
      } else {
        console.log(`🎧 AudioPlayer: Recording not found for ${sessionId}`);
        setHasRecording(false);
      }
    } catch (err) {
      console.error('Failed to check recording:', err);
      setHasRecording(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Failed to play audio:', err);
        setError('Failed to play audio');
        onError?.('Failed to play audio');
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleError = () => {
    setError('Failed to load audio recording');
    setIsPlaying(false);
    onError?.('Failed to load audio recording');
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="audio-player audio-player-loading">
        <div className="audio-player-spinner" />
        <span>Checking for recording...</span>
      </div>
    );
  }

  if (!hasRecording) {
    return null;
  }

  if (error) {
    return (
      <div className="audio-player audio-player-error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={`/api/recordings/${sessionId}/audio`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
      />

      <button
        className="audio-player-play-btn"
        onClick={handlePlayPause}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      <div className="audio-player-progress">
        <span className="audio-player-time">{formatTime(currentTime)}</span>
        <input
          type="range"
          className="audio-player-slider"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          style={{
            background: `linear-gradient(to right, var(--primary-cta-default) ${(currentTime / (duration || 100)) * 100}%, var(--ui-element-divider) ${(currentTime / (duration || 100)) * 100}%)`
          }}
        />
        <span className="audio-player-time">{formatTime(duration)}</span>
      </div>

      <div className="audio-player-label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span>Session Recording</span>
      </div>
    </div>
  );
};
