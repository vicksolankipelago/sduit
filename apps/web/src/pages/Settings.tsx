import React from 'react';
import './Settings.css';

export const SettingsPage: React.FC = () => {
  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1>Settings</h1>
        <p className="settings-subtitle">Configure your SDUI Journey Builder preferences</p>

        <div className="settings-section">
          <h2>General</h2>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Theme</span>
              <span className="settings-item-description">Choose your preferred color theme</span>
            </div>
            <select className="settings-select" disabled>
              <option>System default</option>
              <option>Light</option>
              <option>Dark</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h2>Voice Agent</h2>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Default Voice</span>
              <span className="settings-item-description">Voice used for AI responses</span>
            </div>
            <select className="settings-select" disabled>
              <option>Sage</option>
              <option>Shimmer</option>
              <option>Alloy</option>
              <option>Echo</option>
            </select>
          </div>
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Auto-save Transcripts</span>
              <span className="settings-item-description">Automatically save session transcripts</span>
            </div>
            <label className="settings-toggle">
              <input type="checkbox" disabled />
              <span className="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h2>About</h2>
          <div className="settings-info-row">
            <span>Version</span>
            <span>1.0.0</span>
          </div>
          <div className="settings-info-row">
            <span>Build</span>
            <span>POLICE-843</span>
          </div>
        </div>

        <p className="settings-note">
          More settings coming soon. Contact support for assistance.
        </p>
      </div>
    </div>
  );
};
