import React, { useEffect, useMemo, useState } from 'react';
import './VoiceControlBar.css';

export type ActiveSpeaker = 'agent' | 'member' | 'none';

export interface VoiceControlBarProps {
  isMuted: boolean;
  activeSpeaker?: ActiveSpeaker;
  memberAudioLevel?: number;
  getAgentAudioLevel?: () => number;
  onToggleMute: () => void;
  onKeyboardClick?: () => void;
}

export const VoiceHelpOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="voice-help-overlay" onClick={onClose}>
      <div className="voice-help-card" onClick={(e) => e.stopPropagation()}>
        <div className="voice-help-header">
          <span className="voice-help-title">How it works</span>
          <button className="voice-help-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="voice-help-items">
          <div className="voice-help-item">
            <div className="voice-help-icon voice-help-icon-mic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </div>
            <div className="voice-help-text">
              <strong>Microphone</strong>
              <span>Tap to mute or unmute yourself. Color and motion reflect who is speaking.</span>
            </div>
          </div>
          <div className="voice-help-item">
            <div className="voice-help-icon voice-help-icon-buttons">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
  isMuted,
  activeSpeaker = 'none',
  memberAudioLevel = 0,
  getAgentAudioLevel,
  onToggleMute,
  onKeyboardClick,
}) => {
  const [waveClock, setWaveClock] = useState(0);
  const [agentAudioLevel, setAgentAudioLevel] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let lastSampleAt = 0;

    const sample = (timestamp: number) => {
      if (timestamp - lastSampleAt >= 34) {
        setWaveClock(timestamp);

        if (!isMuted && activeSpeaker === 'agent' && getAgentAudioLevel) {
          const nextLevel = Math.max(0, Math.min(getAgentAudioLevel(), 1));
          setAgentAudioLevel((previousLevel) => (previousLevel * 0.6) + (nextLevel * 0.4));
        } else {
          setAgentAudioLevel((previousLevel) => previousLevel * 0.76);
        }

        lastSampleAt = timestamp;
      }

      frameId = window.requestAnimationFrame(sample);
    };

    frameId = window.requestAnimationFrame(sample);
    return () => window.cancelAnimationFrame(frameId);
  }, [activeSpeaker, getAgentAudioLevel, isMuted]);

  const normalizedAudioLevel = Math.max(0, Math.min(memberAudioLevel, 1));
  const normalizedAgentLevel = Math.max(0, Math.min(agentAudioLevel, 1));
  const liveWaveLevel = isMuted
    ? 0
    : activeSpeaker === 'member'
      ? normalizedAudioLevel
      : activeSpeaker === 'agent'
        ? normalizedAgentLevel
        : 0.08;
  const waveformScale = 1 + normalizedAudioLevel * 0.16;
  const micStateClass = isMuted
    ? 'speaker-muted'
    : activeSpeaker === 'member'
      ? 'speaker-member waveform-active'
      : activeSpeaker === 'agent'
        ? 'speaker-agent'
        : 'speaker-none';
  const micStyle: (React.CSSProperties & { '--voice-mic-wave-scale'?: string }) | undefined =
    !isMuted && activeSpeaker === 'member'
      ? { '--voice-mic-wave-scale': waveformScale.toFixed(3) }
      : undefined;

  const statusLabel = isMuted
    ? "Navi can't hear you"
    : activeSpeaker === 'agent'
      ? 'Navi is speaking'
      : 'Navi is listening';

  const waveformStateClass = isMuted
    ? 'state-muted'
    : activeSpeaker === 'agent'
      ? 'state-agent'
      : activeSpeaker === 'member'
        ? 'state-member'
        : 'state-idle';

  const waveformHeights = useMemo(() => {
    const barProfile = [0.48, 0.78, 1, 0.78, 0.48];
    const barPhase = [0.2, 1.1, 1.9, 2.8, 3.6];

    if (isMuted) {
      return [12, 12, 12, 12, 12];
    }

    if (activeSpeaker === 'none') {
      // Keep the listening state as stable dots, matching the native motivation mock.
      return [12, 12, 12, 12, 12];
    }

    const baseHeight = 12;
    const maxBoost = 8 + (liveWaveLevel * 24);

    return barProfile.map((profile, index) => {
      const phase = barPhase[index];
      const waveA = Math.sin(waveClock * 0.014 + phase);
      const waveB = Math.sin(waveClock * 0.029 + phase * 1.9) * 0.45;
      const dynamic = Math.max(0, Math.min(1, ((waveA + waveB) + 1.45) / 2.45));
      const energy = (0.32 + (liveWaveLevel * 0.68)) * (0.4 + (dynamic * 0.6));
      const height = baseHeight + (profile * maxBoost * energy);
      return Math.round(Math.max(8, Math.min(38, height)));
    });
  }, [activeSpeaker, isMuted, liveWaveLevel, waveClock]);

  return (
    <div className="voice-control-bar">
      <div className="voice-control-bar-container">
        <button
          className={`voice-control-btn voice-control-mic ${isMuted ? 'muted' : ''} ${micStateClass}`}
          style={micStyle}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="4" x2="20" y2="20" />
              <path d="M10 10v2a2 2 0 0 0 3.4 1.4" />
              <path d="M14 8V5a2 2 0 0 0-3.95-.45" />
              <path d="M18 10v2a6 6 0 0 1-10.24 4.24" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M6 10v2a6 6 0 0 0 12 0v-2" />
              <line x1="12" y1="18" x2="12" y2="21" />
            </svg>
          )}
        </button>

        <div className={`voice-control-waveform-group ${waveformStateClass}`}>
          <div className="voice-control-wave-label">{statusLabel}</div>
          <div className="voice-control-waveform" aria-hidden="true">
            {waveformHeights.map((height, index) => (
              <span
                key={index}
                className="voice-control-wave-bar"
                style={
                  {
                    '--voice-wave-bar-height': `${height}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>

        <button
          className="voice-control-btn voice-control-keyboard"
          onClick={onKeyboardClick}
          title="Use keyboard input"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
            <path d="M7 9h.01M11 9h.01M15 9h.01M7 12.5h.01M11 12.5h.01M15 12.5h.01" />
            <line x1="8" y1="16" x2="16" y2="16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VoiceControlBar;
