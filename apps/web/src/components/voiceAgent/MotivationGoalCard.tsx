import React from 'react';
import './MotivationGoalCard.css';

interface MotivationGoalCardProps {
  entryType: 'motivation' | 'goal';
  content: string;
  category: string;
  onDismiss: () => void;
  id?: string;
}

const MotivationGoalCard: React.FC<MotivationGoalCardProps> = ({
  entryType,
  content,
  category,
  onDismiss,
}) => {
  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'health': return '❤️';
      case 'family': return '👨‍👩‍👧‍👦';
      case 'career': return '💼';
      case 'financial': return '💰';
      case 'personal': return '🌟';
      case 'social': return '👥';
      default: return '🎯';
    }
  };

  const typeInfo = entryType === 'motivation' 
    ? { title: 'Motivation Added', emoji: '💪' }
    : { title: 'Goal Set', emoji: '🎯' };

  return (
    <div 
      className="motivation-card"
      role="dialog"
      aria-label={`${typeInfo.title}: ${content}`}
    >
      <div className="motivation-card-content">
        <div className="motivation-icon">
          {getCategoryEmoji(category)}
        </div>
        <div className="motivation-info">
          <div className="motivation-header">
            <span className="motivation-emoji">{typeInfo.emoji}</span>
            <h3 className="motivation-title">{typeInfo.title}</h3>
            <span className="motivation-badge">{category}</span>
          </div>
          <p className="motivation-text">&ldquo;{content}&rdquo;</p>
        </div>
        <button
          onClick={onDismiss}
          className="motivation-close"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MotivationGoalCard;
