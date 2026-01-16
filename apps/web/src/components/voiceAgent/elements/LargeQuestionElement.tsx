import React, { useState } from 'react';
import { LargeQuestionElementState, ScreenEvent } from '../../../types/journey';
import './LargeQuestionElement.css';

export interface LargeQuestionElementProps {
  data: LargeQuestionElementState;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
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
      onEventTrigger(event.id);
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
              <div className="large-question-option-title pelago-body-1-bold">
                {option.title}
              </div>
              {option.description && (
                <div className="large-question-option-description pelago-body-2-regular">
                  {option.description}
                </div>
              )}
            </div>
            {selectedId === option.id && (
              <div className="large-question-option-check">✓</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LargeQuestionElement;

