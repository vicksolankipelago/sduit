import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Navigation } from './Navigation';
import { TermsModal } from './TermsModal';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { hasAcceptedTerms, isMember, isAuthenticated } = useAuth();
  // Initialize preview mode directly from localStorage to avoid flash
  const [isPreviewMode, setIsPreviewMode] = useState(() => {
    return localStorage.getItem('voice-agent-preview-mode') === 'true';
  });

  const handleExitPreview = () => {
    localStorage.removeItem('voice-agent-preview-mode');
    localStorage.removeItem('voice-agent-launch-journey');
    setIsPreviewMode(false);
    navigate('/login');
  };

  const showTermsModal = isAuthenticated && isMember && !hasAcceptedTerms;

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
        {showTermsModal && <TermsModal />}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navigation />
      <main className="app-content">
        <Outlet context={{ isPreviewMode: false }} />
      </main>
      {showTermsModal && <TermsModal />}
    </div>
  );
};
