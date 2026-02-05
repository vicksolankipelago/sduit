import React from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import './MobilePreview.css';

export const MobilePreviewPage: React.FC = () => {
  const { journeyId } = useParams<{ journeyId: string }>();
  const [searchParams] = useSearchParams();

  // Set localStorage synchronously before any navigation/rendering
  if (journeyId) {
    localStorage.setItem('voice-agent-launch-journey', journeyId);
    localStorage.setItem('voice-agent-preview-mode', 'true');
  }

  // Extract Prolific URL parameters and store in localStorage
  const prolificPid = searchParams.get('PROLIFIC_PID');
  const studyId = searchParams.get('STUDY_ID');
  const sessionId = searchParams.get('SESSION_ID');

  if (prolificPid) {
    localStorage.setItem('prolific-pid', prolificPid);
  }
  if (studyId) {
    localStorage.setItem('prolific-study-id', studyId);
  }
  if (sessionId) {
    localStorage.setItem('prolific-session-id', sessionId);
  }

  // Redirect with journey ID in URL so VoiceAgent auto-launches the journey
  // VoiceAgent looks for ?journey= or ?flow= params
  const redirectUrl = journeyId ? `/?journey=${journeyId}` : '/';
  return <Navigate to={redirectUrl} replace />;
};
