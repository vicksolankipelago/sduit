import React from 'react';
import { MiniWidgetData, MiniWidgetElementStyle } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import { useScreenContext } from '../../../contexts/voiceAgent/ScreenContext';
import './MiniWidgetElement.css';

/**
 * MiniWidgetElement Props
 * Matches iOS MiniWidgetElement structure
 */
export interface MiniWidgetElementProps {
  data: MiniWidgetData;
  style?: MiniWidgetElementStyle;
}

// Default icon component - simple circle indicator
const DefaultIndicator: React.FC<{ value: string; backgroundColor?: string }> = ({ value, backgroundColor }) => (
  <div className="mini-widget-indicator" style={backgroundColor ? { backgroundColor } : undefined}>
    <span className="mini-widget-number">{value}</span>
  </div>
);

// Icon component for when an icon name is provided
const WidgetIcon: React.FC<{ iconName: string; color?: string }> = ({ iconName, color }) => {
  // Map common icon names to simple SVG icons
  const iconMap: Record<string, React.ReactNode> = {
    'checkmark': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 10L8 14L16 6" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'flame': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2C10 2 6 6 6 10C6 12.21 7.79 14 10 14C12.21 14 14 12.21 14 10C14 6 10 2 10 2Z" fill={color || '#FF6B35'}/>
        <path d="M10 8C10 8 8 10 8 12C8 13.1 8.9 14 10 14C11.1 14 12 13.1 12 12C12 10 10 8 10 8Z" fill={color || '#FFB800'}/>
      </svg>
    ),
    'star': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L12.09 6.26L17 6.97L13.5 10.34L14.18 15.23L10 13.01L5.82 15.23L6.5 10.34L3 6.97L7.91 6.26L10 2Z" fill={color || '#FFB800'}/>
      </svg>
    ),
    'heart': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 17L8.55 15.7C4.4 12 2 9.9 2 7.2C2 5 3.8 3.2 6 3.2C7.3 3.2 8.5 3.8 9.3 4.7L10 5.5L10.7 4.7C11.5 3.8 12.7 3.2 14 3.2C16.2 3.2 18 5 18 7.2C18 9.9 15.6 12 11.45 15.7L10 17Z" fill={color || '#FF4D6D'}/>
      </svg>
    ),
    'calendar': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="13" rx="2" stroke={color || 'currentColor'} strokeWidth="1.5"/>
        <line x1="3" y1="8" x2="17" y2="8" stroke={color || 'currentColor'} strokeWidth="1.5"/>
        <line x1="7" y1="2" x2="7" y2="5" stroke={color || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="13" y1="2" x2="13" y2="5" stroke={color || 'currentColor'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    'trophy': (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 3H14V8C14 10.21 12.21 12 10 12C7.79 12 6 10.21 6 8V3Z" fill={color || '#FFB800'}/>
        <path d="M4 3H6V6H4C3.45 6 3 5.55 3 5V4C3 3.45 3.45 3 4 3Z" fill={color || '#FFB800'}/>
        <path d="M14 3H16C16.55 3 17 3.45 17 4V5C17 5.55 16.55 6 16 6H14V3Z" fill={color || '#FFB800'}/>
        <rect x="8" y="12" width="4" height="3" fill={color || '#FFB800'}/>
        <rect x="6" y="15" width="8" height="2" rx="1" fill={color || '#FFB800'}/>
      </svg>
    ),
  };

  // Return mapped icon or a default circle with first letter
  if (iconMap[iconName.toLowerCase()]) {
    return <div className="mini-widget-icon">{iconMap[iconName.toLowerCase()]}</div>;
  }

  // Fallback: show first letter of icon name in a circle
  return (
    <div className="mini-widget-icon mini-widget-icon-letter" style={color ? { backgroundColor: color } : undefined}>
      {iconName.charAt(0).toUpperCase()}
    </div>
  );
};

export const MiniWidgetElement: React.FC<MiniWidgetElementProps> = ({
  data,
  style,
}) => {
  const { interpolateString } = useScreenContext();

  // Resolve dynamic values from state
  const resolvedTitle = data.title ? interpolateString(data.title) : '';
  const resolvedContent = data.content ? interpolateString(data.content) : '';
  const resolvedSubtitle = data.subtitle ? interpolateString(data.subtitle) : '';

  // Check if this is a counter widget (title is numeric)
  const isCounterWidget = resolvedTitle && !isNaN(Number(resolvedTitle));
  const hasIcon = data.titleIconName || data.contentIconName;

  const getCardStyle = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};

    // Background color from style or data
    const bgColor = style?.backgroundColor || data.backgroundColor;
    if (bgColor) {
      const cssVar = mapIOSColorToCSSVar(bgColor);
      styles.backgroundColor = `var(${cssVar})`;
    }

    // Text color from style
    if (style?.textColor) {
      const cssVar = mapIOSColorToCSSVar(style.textColor);
      styles.color = `var(${cssVar})`;
    }

    // Border styling
    if (style?.borderColor) {
      const cssVar = mapIOSColorToCSSVar(style.borderColor);
      styles.borderColor = `var(${cssVar})`;
      styles.borderWidth = '1px';
      styles.borderStyle = style.borderDashed ? 'dashed' : 'solid';
    }

    return styles;
  };

  const getIndicatorStyle = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};

    // Use a lighter version of the background color for the indicator
    const bgColor = style?.backgroundColor || data.backgroundColor;
    if (bgColor) {
      // For now, use a slightly darker shade
      styles.backgroundColor = 'rgba(0, 0, 0, 0.08)';
    }

    return styles;
  };

  // Counter widget layout (number in circle + label text)
  if (isCounterWidget) {
    return (
      <div
        className={`mini-widget-element mini-widget-counter ${style?.showAlert ? 'mini-widget-alert' : ''}`}
        style={getCardStyle()}
        data-element-id={data.id}
      >
        {hasIcon && data.titleIconName ? (
          <WidgetIcon iconName={data.titleIconName} />
        ) : (
          <DefaultIndicator value={resolvedTitle} backgroundColor={getIndicatorStyle().backgroundColor as string} />
        )}
        <div className="mini-widget-text">
          <div className="mini-widget-label">{resolvedContent}</div>
          {resolvedSubtitle && (
            <div className="mini-widget-subtitle">{resolvedSubtitle}</div>
          )}
        </div>
        {data.showActionArrow && (
          <div className="mini-widget-arrow">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
    );
  }

  // Text widget layout with optional icon
  return (
    <div
      className={`mini-widget-element mini-widget-text-only ${style?.showAlert ? 'mini-widget-alert' : ''} ${hasIcon ? 'mini-widget-with-icon' : ''}`}
      style={getCardStyle()}
      data-element-id={data.id}
    >
      {hasIcon && (data.titleIconName || data.contentIconName) && (
        <WidgetIcon iconName={data.titleIconName || data.contentIconName || ''} />
      )}
      <div className="mini-widget-text-content">
        <div className="mini-widget-title">{resolvedTitle}</div>
        {resolvedContent && (
          <div className="mini-widget-subtitle">{resolvedContent}</div>
        )}
      </div>
      {data.showActionArrow && (
        <div className="mini-widget-arrow">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  );
};

export default MiniWidgetElement;
