import React from 'react';
import { WeekCheckinSummaryElementState } from '../../../types/journey';
import './WeekCheckinSummaryElement.css';

export interface WeekCheckinSummaryElementProps {
  data: WeekCheckinSummaryElementState;
}

export const WeekCheckinSummaryElement: React.FC<WeekCheckinSummaryElementProps> = ({
  data,
}) => {
  const percentage = (data.checkinCount / data.targetCount) * 100;

  return (
    <div 
      className="week-checkin-summary-element"
      data-element-id={data.id}
    >
      <div className="week-checkin-summary-header">
        <div className="week-checkin-summary-title pelago-body-1-bold">
          Week {data.weekNumber}
        </div>
        <div className="week-checkin-summary-count pelago-header-2">
          {data.checkinCount}/{data.targetCount}
        </div>
      </div>
      <div className="week-checkin-summary-progress">
        <div 
          className="week-checkin-summary-progress-bar"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="week-checkin-summary-label pelago-caption-2-regular">
        Check-ins completed
      </div>
    </div>
  );
};

export default WeekCheckinSummaryElement;

