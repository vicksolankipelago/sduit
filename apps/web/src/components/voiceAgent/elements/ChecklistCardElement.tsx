import React from 'react';
import { ChecklistCardElementState, ChecklistCardElementStyle } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './ChecklistCardElement.css';

export interface ChecklistCardElementProps {
  data: ChecklistCardElementState;
  style?: ChecklistCardElementStyle;
}

// Black checkmark icon - matches Figma design
const CheckmarkIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 10L8 14L16 6"
      stroke="black"
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
  const normalizeItems = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || /^\{\{?\$moduleData\./.test(trimmed)) {
        return [];
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // Fall through to delimiter split.
      }
      return trimmed
        .split(/[\n;]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  };

  const items = normalizeItems((data as unknown as Record<string, unknown>).itemTitles);
  if (items.length === 0) {
    return null;
  }

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
        {items.map((item, index) => (
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
