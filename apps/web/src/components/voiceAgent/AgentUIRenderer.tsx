import React from 'react';
import { useAgentUI } from '../../contexts/voiceAgent/AgentUIContext';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import ScreenPreview from './ScreenPreview';
import './AgentUIRenderer.css';

interface AgentUIRendererProps {
  bottomBar?: React.ReactNode;
  onOpenSettings?: () => void;
  onExit?: () => void;
}

export default function AgentUIRenderer({ bottomBar, onOpenSettings, onExit }: AgentUIRendererProps) {
  const {
    screenRenderingMode,
    currentAgentScreens,
    currentScreenId,
    moduleState
  } = useAgentUI();

  // Debug logging
  React.useEffect(() => {
    console.log('🎨 AgentUIRenderer state:', {
      screenRenderingMode,
      screenCount: currentAgentScreens?.length || 0,
      currentScreenId,
      hasCurrentScreen: currentAgentScreens && currentAgentScreens.find(s => s.id === currentScreenId) ? 'yes' : 'no',
    });
  }, [screenRenderingMode, currentAgentScreens, currentScreenId]);

  // If in screen rendering mode, render the screen inside a device frame
  if (screenRenderingMode && currentAgentScreens && currentScreenId) {
    const currentScreen = currentAgentScreens.find(s => s.id === currentScreenId);

    console.log('🎨 Rendering screen:', currentScreenId, currentScreen ? 'found' : 'NOT FOUND');

    // Only render if we have a valid screen to avoid context errors
    if (currentScreen && currentScreen.id) {
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
                <ScreenProvider initialScreen={currentScreen} initialModuleState={moduleState}>
                  <ScreenPreview
                    key={currentScreen.id}
                    screen={currentScreen}
                    allScreens={currentAgentScreens}
                    showDeviceFrame={false}
                    editable={false}
                  />
                </ScreenProvider>
              </div>
              {bottomBar && (
                <div className="agent-ui-device-bottom-bar">
                  {bottomBar}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  // No SDUI screen available - return null (legacy card-based UI removed)
  return null;
}
