import React from 'react';
import { ChecklistCardElementState, ChecklistCardElementStyle } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './ChecklistCardElement.css';

export interface ChecklistCardElementProps {
  data: ChecklistCardElementState;
  style?: ChecklistCardElementStyle;
}

// Green filled circle with white checkmark - matches iOS SelectorCheck component
const CheckmarkIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="10" fill="#4CAF50"/>
    <path
      d="M6 10L9 13L14 7"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChecklistCardElement: React.FC<ChecklistCardElementProps> = ({
  data,
  style,
}) => {
  const getCardStyle = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};

    if (style?.backgroundColor) {
      const cssVar = mapIOSColorToCSSVar(style.backgroundColor);
      styles.backgroundColor = `var(${cssVar})`;
    }

    if (style?.cornerRadius) {
      styles.borderRadius = `${style.cornerRadius}px`;
    }

    return styles;
  };

  return (
    <div
      className="checklist-card-element"
      style={getCardStyle()}
      data-element-id={data.id}
    >
      {data.title && (
        <div className="checklist-card-title pelago-body-1-bold">
          {data.title}
        </div>
      )}
      <ul className="checklist-card-items">
        {data.itemTitles.map((item, index) => (
          <li key={index} className="checklist-card-item pelago-body-2-regular">
            <span className="checklist-card-checkmark">
              <CheckmarkIcon />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChecklistCardElement;

