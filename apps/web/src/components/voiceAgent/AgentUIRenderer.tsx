import React from 'react';
import { useAgentUI } from '../../contexts/voiceAgent/AgentUIContext';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import { logger } from '../../utils/logger';
import ScreenPreview from './ScreenPreview';
import NotificationPermissionPopup from './NotificationPermissionPopup';
import './AgentUIRenderer.css';

const uiLogger = logger.namespace('AgentUIRenderer');

interface AgentUIRendererProps {
  bottomBar?: React.ReactNode;
  onOpenSettings?: () => void;
  onExit?: () => void;
  showNotificationPopup?: boolean;
  onNotificationAllow?: () => void;
  onNotificationDeny?: () => void;
}

export default function AgentUIRenderer({ bottomBar, onOpenSettings, onExit, showNotificationPopup, onNotificationAllow, onNotificationDeny }: AgentUIRendererProps) {
  const {
    screenRenderingMode,
    currentAgentScreens,
    currentScreenId,
    moduleState
  } = useAgentUI();

  // Debug logging
  React.useEffect(() => {
    uiLogger.debug('State:', {
      screenRenderingMode,
      screenCount: currentAgentScreens?.length || 0,
      currentScreenId,
      hasCurrentScreen: currentAgentScreens && currentAgentScreens.find(s => s.id === currentScreenId) ? 'yes' : 'no',
    });
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
              title="Session settings"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          )}
          {onExit && (
            <button
              className="agent-ui-control-btn agent-ui-exit-btn"
              onClick={onExit}
              title="Exit to journeys"
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
            <div className="agent-ui-device-screen">
              {currentScreen && currentScreen.id ? (
                <ScreenProvider initialScreen={currentScreen} initialModuleState={moduleState}>
                  <ScreenPreview
                    key={currentScreen.id}
                    screen={currentScreen}
                    allScreens={currentAgentScreens}
                    showDeviceFrame={false}
                    editable={false}
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

  // No SDUI screen available - return null (legacy card-based UI removed)
  return null;
}
