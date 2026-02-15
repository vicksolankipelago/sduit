import React from 'react';
import { useAgentUI } from '../../contexts/voiceAgent/AgentUIContext';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import { logger } from '../../utils/logger';
import { ElevenLabsAudioAlignmentSnapshot } from '../../types/voiceAgent';
import ScreenPreview from './ScreenPreview';
import NotificationPermissionPopup from './NotificationPermissionPopup';
import './AgentUIRenderer.css';

const uiLogger = logger.namespace('AgentUIRenderer');

interface AgentUIRendererProps {
  bottomBar?: React.ReactNode;
  helpOverlay?: React.ReactNode;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
  onExit?: () => void;
  showNotificationPopup?: boolean;
  onNotificationAllow?: () => void;
  onNotificationDeny?: () => void;
  onSetVoiceEnabled?: (enabled: boolean) => void; // Callback for setVoiceEnabled tool - must be called synchronously to preserve user gesture
  activeSpeaker?: 'agent' | 'member' | 'none';
  memberAudioLevel?: number;
  getOutputVolume?: () => number;
  sessionConnected?: boolean;
  agentSpeechAlignment?: ElevenLabsAudioAlignmentSnapshot | null;
  agentSpeechPlaybackMs?: number | null;
  agentSpeechPlaybackAnchorMs?: number | null;
}

export default function AgentUIRenderer({
  bottomBar,
  helpOverlay,
  onOpenHelp,
  onOpenSettings,
  onExit,
  showNotificationPopup,
  onNotificationAllow,
  onNotificationDeny,
  onSetVoiceEnabled,
  activeSpeaker,
  memberAudioLevel,
  getOutputVolume,
  sessionConnected,
  agentSpeechAlignment,
  agentSpeechPlaybackMs,
  agentSpeechPlaybackAnchorMs,
}: AgentUIRendererProps) {
  const {
    screenRenderingMode,
    currentAgentScreens,
    currentScreenId,
    moduleState,
    updateModuleState
  } = useAgentUI();

  // Debug logging - also log to console for debugging
  React.useEffect(() => {
    const debugInfo = {
      screenRenderingMode,
      screenCount: currentAgentScreens?.length || 0,
      currentScreenId,
      hasCurrentScreen: currentAgentScreens && currentAgentScreens.find(s => s.id === currentScreenId) ? 'yes' : 'no',
      firstScreenId: currentAgentScreens?.[0]?.id || 'none',
    };
    uiLogger.debug('State:', debugInfo);
    console.log('🖥️ AgentUIRenderer state:', JSON.stringify(debugInfo));
  }, [screenRenderingMode, currentAgentScreens, currentScreenId]);

  // If in screen rendering mode, render the screen inside a device frame
  if (screenRenderingMode && currentAgentScreens && currentScreenId) {
    const currentScreen = currentAgentScreens.find(s => s.id === currentScreenId);

    uiLogger.debug('Rendering screen:', currentScreenId, currentScreen ? 'found' : 'NOT FOUND');
    
    if (!currentScreen) {
      uiLogger.debug('Available screen IDs:', currentAgentScreens.map(s => s.id));
      uiLogger.debug('Requested screen ID:', currentScreenId);
    }

    // Render device frame with either the screen or an error message
    return (
      <div className="agent-ui-overlay agent-ui-screen-mode">
        {/* Top right controls - Settings and Exit */}
        <div className="agent-ui-top-controls">
          {onOpenSettings && (
            <button
              className="agent-ui-control-btn agent-ui-settings-btn"
              onClick={onOpenSettings}
              title="Session logs"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </button>
          )}
          {onExit && (
            <button
              className="agent-ui-control-btn agent-ui-exit-btn"
              onClick={onExit}
              title="Exit to flows"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Device frame containing screen and bottom bar */}
        <div className="agent-ui-device-frame">
          <div className="agent-ui-device-screen-wrapper">
            {onOpenHelp && currentScreen?.id !== 'pq-voice-ready' && (
              <button
                className="agent-ui-device-help-btn"
                onClick={onOpenHelp}
                title="How it works"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
            )}
            <div className="agent-ui-device-screen">
              {currentScreen && currentScreen.id ? (
                <ScreenProvider
                  key={`screen-provider-${currentScreen.id}-${currentAgentScreens.length}`}
                  initialScreen={currentScreen}
                  initialModuleState={moduleState}
                  allScreens={currentAgentScreens}
                  onSetVoiceEnabled={onSetVoiceEnabled}
                  onModuleStateChange={updateModuleState}
                >
                  <ScreenPreview
                    key={currentScreen.id}
                    screen={currentScreen}
                    allScreens={currentAgentScreens}
                    showDeviceFrame={false}
                    editable={false}
                    activeSpeaker={activeSpeaker}
                    memberAudioLevel={memberAudioLevel}
                    getOutputVolume={getOutputVolume}
                    sessionConnected={sessionConnected}
                    agentSpeechAlignment={agentSpeechAlignment}
                    agentSpeechPlaybackMs={agentSpeechPlaybackMs}
                    agentSpeechPlaybackAnchorMs={agentSpeechPlaybackAnchorMs}
                  />
                </ScreenProvider>
              ) : (
                <div className="agent-ui-screen-error">
                  <div className="agent-ui-screen-error-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <div className="agent-ui-screen-error-title">Screen Not Found</div>
                  <div className="agent-ui-screen-error-message">
                    Screen ID: <code>{currentScreenId}</code>
                  </div>
                  <div className="agent-ui-screen-error-available">
                    Available screens: {currentAgentScreens.map(s => s.id).join(', ')}
                  </div>
                </div>
              )}
            </div>
            {bottomBar && (
              <div className="agent-ui-device-bottom-bar">
                {bottomBar}
              </div>
            )}
            {helpOverlay}
          </div>
          
          {/* Notification Permission Popup - rendered inside device frame */}
          {showNotificationPopup && onNotificationAllow && onNotificationDeny && (
            <NotificationPermissionPopup
              onAllow={onNotificationAllow}
              onDeny={onNotificationDeny}
            />
          )}
        </div>
      </div>
    );
  }

  // No SDUI screen available - return null to show the underlying flows page
  return null;
}
