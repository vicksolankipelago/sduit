import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import './MobilePreview.css';

export const MobilePreviewPage: React.FC = () => {
  const { journeyId } = useParams<{ journeyId: string }>();

  // Set localStorage synchronously before any navigation/rendering
  if (journeyId) {
    localStorage.setItem('voice-agent-launch-journey', journeyId);
    localStorage.setItem('voice-agent-preview-mode', 'true');
  }

  // Use Navigate component for immediate redirect (no useEffect delay)
  return <Navigate to="/" replace />;
};
