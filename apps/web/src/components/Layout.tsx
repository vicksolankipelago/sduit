import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Navigation } from './Navigation';
import './Layout.css';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    const previewMode = localStorage.getItem('voice-agent-preview-mode') === 'true';
    setIsPreviewMode(previewMode);
  }, []);

  const handleExitPreview = () => {
    localStorage.removeItem('voice-agent-preview-mode');
    localStorage.removeItem('voice-agent-launch-journey');
    setIsPreviewMode(false);
    navigate('/login');
  };

  if (isPreviewMode) {
    return (
      <div className="app-layout preview-mode">
        <button className="preview-exit-btn" onClick={handleExitPreview} title="Exit preview">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <main className="app-content full-width">
          <Outlet context={{ isPreviewMode: true }} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navigation />
      <main className="app-content">
        <Outlet context={{ isPreviewMode: false }} />
      </main>
    </div>
  );
};
