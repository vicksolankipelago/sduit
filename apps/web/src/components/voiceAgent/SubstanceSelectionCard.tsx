import React from 'react';
import './SubstanceSelectionCard.css';

interface SubstanceSelectionCardProps {
  substance: string;
  onDismiss: () => void;
  id?: string;
}

export default function SubstanceSelectionCard({ 
  substance,
  onDismiss,
}: SubstanceSelectionCardProps) {
  const getSubstanceInfo = (substance: string) => {
    switch (substance) {
      case 'alcohol':
        return {
          title: 'Drinking (alcohol)',
          subtitle: 'Build awareness, reduce, or quit',
          emoji: '🍺',
        };
      case 'tobacco':
      case 'smoking':
        return {
          title: 'Smoking (tobacco)',
          subtitle: 'Build awareness, reduce, or quit',
          emoji: '🚬',
        };
      case 'opioids':
        return {
          title: 'Opioids',
          subtitle: 'Build awareness, reduce, or quit',
          emoji: '💊',
        };
      default:
        return {
          title: substance,
          subtitle: 'Build awareness, reduce, or quit',
          emoji: '📋',
        };
    }
  };

  const substanceInfo = getSubstanceInfo(substance);

  return (
    <div 
      className="substance-card"
      role="dialog"
      aria-label={`Substance selection: ${substanceInfo.title}`}
    >
      <div className="substance-card-content">
        <div className="substance-icon">
          <span>{substanceInfo.emoji}</span>
        </div>
        <div className="substance-info">
          <h3 className="substance-title">{substanceInfo.title}</h3>
          <p className="substance-subtitle">{substanceInfo.subtitle}</p>
        </div>
        <button
          onClick={onDismiss}
          className="substance-close"
          aria-label="Dismiss"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
