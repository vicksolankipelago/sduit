import React, { useState } from 'react';
import { LargeQuestionElementState, LargeQuestionOptionPill, ScreenEvent } from '../../../types/journey';
import './LargeQuestionElement.css';

// Pill icon component
const PillIcon: React.FC<{ iconName?: string }> = ({ iconName }) => {
  const iconMap: Record<string, React.ReactNode> = {
    'coin': (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="#FFB800" stroke="#E5A600" strokeWidth="1"/>
        <text x="8" y="11" textAnchor="middle" fill="#805C00" fontSize="8" fontWeight="bold">$</text>
      </svg>
    ),
    'star': (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1L9.8 5.6L14.8 6.1L11.1 9.4L12.2 14.3L8 11.8L3.8 14.3L4.9 9.4L1.2 6.1L6.2 5.6L8 1Z" fill="#FFB800"/>
      </svg>
    ),
    'check': (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="#22C55E"/>
        <path d="M5 8L7 10L11 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'pelatoken': (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="#6366F1"/>
        <circle cx="8" cy="8" r="4" fill="#A5B4FC"/>
      </svg>
    ),
  };

  if (!iconName || !iconMap[iconName.toLowerCase()]) {
    // Default coin icon
    return <>{iconMap['coin']}</>;
  }

  return <>{iconMap[iconName.toLowerCase()]}</>;
};

// Pill component for reward points
const OptionPill: React.FC<{ pill: LargeQuestionOptionPill }> = ({ pill }) => {
  const style: React.CSSProperties = {};
  if (pill.backgroundColor) {
    style.backgroundColor = pill.backgroundColor;
  }

  return (
    <div className="large-question-option-pill" style={style}>
      <PillIcon iconName={pill.iconName} />
      <span className="large-question-option-pill-text">{pill.text}</span>
    </div>
  );
};

export interface LargeQuestionElementProps {
  data: LargeQuestionElementState;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string, eventData?: Record<string, any>) => void;
}

export const LargeQuestionElement: React.FC<LargeQuestionElementProps> = ({
  data,
  events,
  onEventTrigger,
}) => {
  const [selectedId, setSelectedId] = useState(data.selectedOptionId);

  const handleSelect = (optionId: string) => {
    setSelectedId(optionId);
    
    const event = events?.find(e => e.type === 'onSelected');
    if (event && onEventTrigger) {
      // Pass storeKey and selected value with the event so it can be stored in moduleState
      // Use explicit storeKey if provided, otherwise derive from element ID (removes common suffixes)
      const derivedStoreKey = data.storeKey || 
        data.id?.replace(/_question$/, '').replace(/_element$/, '') || 
        undefined;
      
      const eventData: Record<string, any> = {
        selectedValue: optionId,
      };
      if (derivedStoreKey) {
        eventData.storeKey = derivedStoreKey;
        console.log(`📝 LargeQuestion: Storing ${derivedStoreKey} = ${optionId}`);
      }
      onEventTrigger(event.id, eventData);
    }
  };

  // Get title from either data.title or data.header.title (iOS structure)
  const getTitle = () => {
    if (data.title) return data.title;
    if ((data as any).header?.title) return (data as any).header.title;
    return '';
  };

  return (
    <div className="large-question-element" data-element-id={data.id}>
      {getTitle() && (
        <div className="large-question-title pelago-header-2">
          {getTitle()}
        </div>
      )}
      <div className="large-question-options">
        {data.options.map((option) => (
          <button
            key={option.id}
            className={`large-question-option ${selectedId === option.id ? 'selected' : ''}`}
            onClick={() => handleSelect(option.id)}
          >
            {option.imageName && (
              <div className="large-question-option-image">
                {/* Image placeholder */}
                🎯
              </div>
            )}
            <div className="large-question-option-content">
              <div className="large-question-option-header">
                <div className="large-question-option-title">
                  {option.title}
                </div>
                {option.pill && <OptionPill pill={option.pill} />}
              </div>
              {option.description && (
                <div className="large-question-option-description pelago-body-2-regular">
                  {option.description}
                </div>
              )}
            </div>
            {selectedId === option.id && (
              <div className="large-question-option-check">
                <svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="11" fill="#212633"/>
                  <path d="M6 11L9.5 14.5L16 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LargeQuestionElement;

