import React from 'react';
import { CareCallElementState, CareCallElementStyle, ScreenEvent } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './CareCallCardElement.css';

export interface CareCallCardElementProps {
  data: CareCallElementState;
  style?: CareCallElementStyle;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
}

export const CareCallCardElement: React.FC<CareCallCardElementProps> = ({
  data,
  style,
  events,
  onEventTrigger,
}) => {
  const handleJoinCall = () => {
    const event = events?.find(e => e.id === data.callActionEventId);
    if (event && onEventTrigger) {
      onEventTrigger(event.id);
    }
  };

  const handleViewDetails = () => {
    const event = events?.find(e => e.id === data.callDetailsEventId);
    if (event && onEventTrigger) {
      onEventTrigger(event.id);
    }
  };

  const formatTime = (timeString: string): string => {
    try {
      const date = new Date(timeString);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return timeString;
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
      styles.borderWidth = '2px';
      styles.borderStyle = 'solid';
    }

    if (style?.cornerRadius) {
      styles.borderRadius = `${style.cornerRadius}px`;
    }

    return styles;
  };

  return (
    <div 
      className="care-call-card-element"
      style={getCardStyle()}
      data-element-id={data.id}
    >
      <div className="care-call-card-header">
        <div className="care-call-card-icon">📞</div>
        <div className="care-call-card-header-text">
          <div className="care-call-card-type pelago-caption-2-bold">
            {data.callType.toUpperCase()}
          </div>
          <div className="care-call-card-reason pelago-body-1-bold">
            {data.reason}
          </div>
        </div>
      </div>

      <div className="care-call-card-details">
        <div className="care-call-card-detail">
          <span className="care-call-card-detail-label pelago-body-2-regular">Time:</span>
          <span className="care-call-card-detail-value pelago-body-2-bold">
            {formatTime(data.time)}
          </span>
        </div>
        <div className="care-call-card-detail">
          <span className="care-call-card-detail-label pelago-body-2-regular">With:</span>
          <span className="care-call-card-detail-value pelago-body-2-bold">
            {data.participant}
          </span>
        </div>
        <div className="care-call-card-detail">
          <span className="care-call-card-detail-label pelago-body-2-regular">Duration:</span>
          <span className="care-call-card-detail-value pelago-body-2-bold">
            {data.duration} min
          </span>
        </div>
      </div>

      {data.alertText && (
        <div className={`care-call-card-alert ${data.isAlertInfo ? 'info' : 'warning'}`}>
          <span className="care-call-card-alert-icon">
            {data.isAlertInfo ? 'ℹ️' : '⚠️'}
          </span>
          <span className="pelago-body-2-regular">{data.alertText}</span>
        </div>
      )}

      <div className="care-call-card-actions">
        {data.canBeJoined && (
          <button 
            className="care-call-card-button care-call-card-button-primary pelago-button-2-bold"
            onClick={handleJoinCall}
          >
            {data.ctaTitle}
          </button>
        )}
        {data.canEdit && (
          <button 
            className="care-call-card-button care-call-card-button-secondary pelago-button-2-bold"
            onClick={handleViewDetails}
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
};

export default CareCallCardElement;

