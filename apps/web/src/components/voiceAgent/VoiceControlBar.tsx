import React, { useState } from 'react';
import './VoiceControlBar.css';

export interface VoiceControlBarProps {
  isListening: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall?: () => void;
  onOpenSettings?: () => void;
}

const HelpOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="voice-help-overlay" onClick={onClose}>
      <div className="voice-help-card" onClick={(e) => e.stopPropagation()}>
        <div className="voice-help-header">
          <span className="voice-help-title">How it works</span>
          <button className="voice-help-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="voice-help-items">
          <div className="voice-help-item">
            <div className="voice-help-icon voice-help-icon-mic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
            </div>
            <div className="voice-help-text">
              <strong>Microphone</strong>
              <span>Tap to mute or unmute yourself. Pulses when listening.</span>
            </div>
          </div>
          <div className="voice-help-item">
            <div className="voice-help-icon voice-help-icon-buttons">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <div className="voice-help-text">
              <strong>On-screen buttons</strong>
              <span>Navi will guide you. You can also tap buttons on screen to answer questions.</span>
            </div>
          </div>
          <div className="voice-help-item">
            <div className="voice-help-icon voice-help-icon-speak">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="voice-help-text">
              <strong>Just speak naturally</strong>
              <span>Answer in your own words. There are no right or wrong answers.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  isListening,
  isMuted,
  onToggleMute,
  onEndCall,
  onOpenSettings,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div className="voice-control-bar">
        <div className="voice-control-bar-container">
          {/* Help Button */}
          <button
            className="voice-control-btn voice-control-help"
            onClick={() => setShowHelp(true)}
            title="Help"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
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
          </button>

          {/* End Call Button */}
          {onEndCall && (
            <button
              className="voice-control-btn voice-control-end-call"
              onClick={onEndCall}
              title="End call"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
                <line x1="23" y1="1" x2="1" y2="23"/>
              </svg>
            </button>
          )}

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

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </>
  );
};

export default VoiceControlBar;

