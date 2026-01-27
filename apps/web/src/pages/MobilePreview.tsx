import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MobilePreview.css';

export const MobilePreviewPage: React.FC = () => {
  const { journeyId } = useParams<{ journeyId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (journeyId) {
      localStorage.setItem('voice-agent-launch-journey', journeyId);
      navigate('/', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [journeyId, navigate]);

  return (
    <div className="mobile-preview-loading">
      <div className="mobile-preview-spinner" />
      <p>Loading voice agent...</p>
    </div>
  );
};
