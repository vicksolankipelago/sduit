import React, { useState, useEffect } from 'react';
import { CheckboxButtonElementState, CheckboxButtonElementStyle, ScreenEvent } from '../../../types/journey';
import './CheckboxButtonElement.css';

export interface CheckboxButtonElementProps {
  data: CheckboxButtonElementState;
  style?: CheckboxButtonElementStyle;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
}

// Green filled circle with white checkmark - matches iOS SelectorCheck component
const SelectorCheckIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="11" fill="#212633"/>
    <path
      d="M6.5 11L9.5 14L15.5 8"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CheckboxButtonElement: React.FC<CheckboxButtonElementProps> = ({
  data,
  style,
  events,
  onEventTrigger,
}) => {
  const [isSelected, setIsSelected] = useState(data.isSelected || false);

  // Sync with external state changes
  useEffect(() => {
    setIsSelected(data.isSelected || false);
  }, [data.isSelected]);

  const handleToggle = () => {
    const newValue = !isSelected;
    setIsSelected(newValue);

    const event = events?.find(e => e.type === 'onSelected');
    if (event && onEventTrigger) {
      onEventTrigger(event.id);
    }
  };

  const buttonClassName = `checkbox-button-element ${isSelected ? 'checkbox-button-element-selected' : ''}`;
  const titleClassName = isSelected ? 'checkbox-button-title pelago-body-1-bold' : 'checkbox-button-title pelago-body-1-regular';

  return (
    <button
      className={buttonClassName}
      onClick={handleToggle}
      data-element-id={data.id}
      type="button"
    >
      <span className={titleClassName}>
        {data.title}
      </span>
      {isSelected && (
        <span className="checkbox-button-check-icon">
          <SelectorCheckIcon />
        </span>
      )}
    </button>
  );
};

export default CheckboxButtonElement;

