import React, { useState, useEffect } from 'react';
import { ToggleCardElementState, ToggleCardElementStyle, ScreenEvent } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './ToggleCardElement.css';

export interface ToggleCardElementProps {
  data: ToggleCardElementState;
  style?: ToggleCardElementStyle;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
}

// Notification bell icon - matches iOS design
const NotificationIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z"
      fill="#212633"
    />
  </svg>
);

export const ToggleCardElement: React.FC<ToggleCardElementProps> = ({
  data,
  style,
  events,
  onEventTrigger,
}) => {
  const [isToggled, setIsToggled] = useState(data.isToggled);

  // Sync with external state changes
  useEffect(() => {
    setIsToggled(data.isToggled);
  }, [data.isToggled]);

  const handleToggle = () => {
    const newValue = !isToggled;
    setIsToggled(newValue);

    // Trigger appropriate event
    const eventType = newValue ? 'onToggleOn' : 'onToggleOff';
    const event = events?.find(e => e.type === eventType) || events?.find(e => e.type === 'onToggle');

    if (event && onEventTrigger) {
      onEventTrigger(event.id);
    }
  };

  const getCardStyle = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};

    if (style?.backgroundColor) {
      const cssVar = mapIOSColorToCSSVar(style.backgroundColor);
      styles.backgroundColor = `var(${cssVar})`;
    }

    if (style?.borderColor) {
      const cssVar = mapIOSColorToCSSVar(style.borderColor);
      styles.borderColor = `var(${cssVar})`;
    }

    if (style?.cornerRadius) {
      styles.borderRadius = `${style.cornerRadius}px`;
    }

    return styles;
  };

  return (
    <div
      className="toggle-card-element"
      style={getCardStyle()}
      data-element-id={data.id}
    >
      {data.label && (
        <div className="toggle-card-label-container">
          <span className="toggle-card-label pelago-body-2-regular">
            {data.label}
          </span>
        </div>
      )}
      <div className="toggle-card-row">
        <div className="toggle-card-content">
          {style?.icon && (
            <div className="toggle-card-icon">
              <NotificationIcon />
            </div>
          )}
          <div className="toggle-card-text">
            <div className="toggle-card-title pelago-header-3">
              {data.title}
            </div>
            {data.description && (
              <div className="toggle-card-description pelago-body-2-regular">
                {data.description}
              </div>
            )}
          </div>
        </div>
        <label className="toggle-card-switch">
          <input
            type="checkbox"
            checked={isToggled}
            onChange={handleToggle}
          />
          <span className="toggle-card-slider"></span>
        </label>
      </div>
    </div>
  );
};

export default ToggleCardElement;

