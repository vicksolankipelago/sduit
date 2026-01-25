import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScreenProvider } from '../contexts/voiceAgent/ScreenContext';
import ScreenPreview from '../components/voiceAgent/ScreenPreview';
import { Agent, Screen } from '../types/journey';
import './MobilePreview.css';

interface PreviewJourney {
  id: string;
  name: string;
  agents: Agent[];
  startingAgentId: string;
}

export const MobilePreviewPage: React.FC = () => {
  const { journeyId } = useParams<{ journeyId: string }>();
  const [_journey, setJourney] = useState<PreviewJourney | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen | null>(null);
  const [allScreens, setAllScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadJourney() {
      if (!journeyId) {
        setError('No journey ID provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/journeys/preview/${journeyId}`);
        if (!response.ok) {
          throw new Error('Journey not found');
        }
        
        const data: PreviewJourney = await response.json();
        setJourney(data);

        const startingAgent = data.agents.find(a => a.id === data.startingAgentId);
        if (startingAgent?.screens && startingAgent.screens.length > 0) {
          setAllScreens(startingAgent.screens);
          setCurrentScreen(startingAgent.screens[0]);
        } else {
          const allAgentScreens = data.agents.flatMap(a => a.screens || []);
          if (allAgentScreens.length > 0) {
            setAllScreens(allAgentScreens);
            setCurrentScreen(allAgentScreens[0]);
          } else {
            setError('No screens found in this journey');
          }
        }
      } catch (err) {
        console.error('Error loading journey:', err);
        setError(err instanceof Error ? err.message : 'Failed to load journey');
      } finally {
        setLoading(false);
      }
    }

    loadJourney();
  }, [journeyId]);

  if (loading) {
    return (
      <div className="mobile-preview-loading">
        <div className="mobile-preview-spinner" />
        <p>Loading preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-preview-error">
        <h2>Preview Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!currentScreen) {
    return (
      <div className="mobile-preview-error">
        <h2>No Screens Available</h2>
        <p>This journey has no screens to preview.</p>
      </div>
    );
  }

  return (
    <div className="mobile-preview-page">
      <ScreenProvider initialScreen={currentScreen}>
        <ScreenPreview
          screen={currentScreen}
          allScreens={allScreens}
          showDeviceFrame={false}
          editable={false}
        />
      </ScreenProvider>
    </div>
  );
};
