import React from 'react';
import './VoiceControlBar.css';

export interface VoiceControlBarProps {
  isListening: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSettings?: () => void;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  isListening,
  isMuted,
  onToggleMute,
  onOpenSettings,
}) => {
  return (
    <div className="voice-control-bar">
      <div className="voice-control-bar-container">
        {/* Microphone Button */}
        <button
          className={`voice-control-btn voice-control-mic ${isMuted ? 'muted' : ''} ${isListening ? 'listening' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          )}
        </button>

        {/* Settings Button */}
        {onOpenSettings && (
          <button
            className="voice-control-btn voice-control-settings"
            onClick={onOpenSettings}
            title="Session settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceControlBar;

