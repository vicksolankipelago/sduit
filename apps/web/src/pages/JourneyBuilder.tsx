import React from 'react';
import JourneyBuilder from '../components/voiceAgent/JourneyBuilder';
import { TranscriptProvider } from '../contexts/voiceAgent/TranscriptContext';
import { EventProvider } from '../contexts/voiceAgent/EventContext';
import { AgentUIProvider } from '../contexts/voiceAgent/AgentUIContext';
import './JourneyBuilder.css';

export const JourneyBuilderPage: React.FC = () => {
  return (
    <TranscriptProvider>
      <EventProvider>
        <AgentUIProvider>
          <div className="journey-builder-page">
            <JourneyBuilder />
          </div>
        </AgentUIProvider>
      </EventProvider>
    </TranscriptProvider>
  );
};
