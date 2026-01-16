import React from 'react';
import './VoiceControlBar.css';

export interface VoiceControlBarProps {
  isListening: boolean;
  isMuted: boolean;
  onToggleKeyboard: () => void;
  onToggleMute: () => void;
  onEndCall: () => void;
  onOpenSettings?: () => void;
  showKeyboardInput?: boolean;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  isListening,
  isMuted,
  onToggleKeyboard,
  onToggleMute,
  onEndCall,
  onOpenSettings,
  showKeyboardInput = false,
}) => {
  return (
    <div className="voice-control-bar">
      <div className="voice-control-bar-container">
        {/* Keyboard Input Toggle */}
        <button
          className={`voice-control-btn voice-control-keyboard ${showKeyboardInput ? 'active' : ''}`}
          onClick={onToggleKeyboard}
          title="Toggle keyboard input"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
          </svg>
        </button>

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
          {isListening && !isMuted && (
            <>
              <div className="mic-pulse-ring mic-pulse-ring-1"></div>
              <div className="mic-pulse-ring mic-pulse-ring-2"></div>
              <div className="mic-pulse-ring mic-pulse-ring-3"></div>
            </>
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

        {/* End Call Button */}
        <button
          className="voice-control-btn voice-control-end-call"
          onClick={onEndCall}
          title="End voice session"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            <line x1="23" y1="1" x2="1" y2="23"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VoiceControlBar;

