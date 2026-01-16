import React from 'react';
import { useNavigate } from 'react-router-dom';
import JourneyBuilder from '../components/voiceAgent/JourneyBuilder';
import { TranscriptProvider } from '../contexts/voiceAgent/TranscriptContext';
import { EventProvider } from '../contexts/voiceAgent/EventContext';
import { AgentUIProvider } from '../contexts/voiceAgent/AgentUIContext';
import { Journey } from '../types/journey';
import './JourneyBuilder.css';

export const JourneyBuilderPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunchJourney = (journey: Journey) => {
    // Store journey ID to launch and navigate to main page
    localStorage.setItem('voice-agent-launch-journey', journey.id);
    navigate('/');
  };

  return (
    <TranscriptProvider>
      <EventProvider>
        <AgentUIProvider>
          <div className="journey-builder-page">
            <JourneyBuilder onLaunchJourney={handleLaunchJourney} />
          </div>
        </AgentUIProvider>
      </EventProvider>
    </TranscriptProvider>
  );
};
