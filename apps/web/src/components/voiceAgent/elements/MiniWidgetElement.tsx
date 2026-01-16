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

export const MiniWidgetElement: React.FC<MiniWidgetElementProps> = ({
  data,
  style,
}) => {
  const { interpolateString } = useScreenContext();

  // Resolve dynamic values from state
  // iOS structure: title = value (e.g., "7"), content = label (e.g., "Day streak")
  const resolvedTitle = data.title ? interpolateString(data.title) : '';
  const resolvedContent = data.content ? interpolateString(data.content) : '';
  const resolvedSubtitle = data.subtitle ? interpolateString(data.subtitle) : '';

  // Check if this is a counter widget (title is numeric)
  const isCounterWidget = resolvedTitle && !isNaN(Number(resolvedTitle));

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

  // Counter widget layout (number in circle + label text)
  if (isCounterWidget) {
    return (
      <div
        className={`mini-widget-element mini-widget-counter ${style?.showAlert ? 'mini-widget-alert' : ''}`}
        style={getCardStyle()}
        data-element-id={data.id}
      >
        <div className="mini-widget-indicator">
          <span className="mini-widget-number pelago-header-2">{resolvedTitle}</span>
        </div>
        <div className="mini-widget-text">
          <div className="mini-widget-title pelago-body-1-bold">{resolvedContent}</div>
          {resolvedSubtitle && (
            <div className="mini-widget-subtitle pelago-body-2-regular">{resolvedSubtitle}</div>
          )}
        </div>
      </div>
    );
  }

  // Text widget layout (title as main text, content as subtitle)
  return (
    <div
      className={`mini-widget-element mini-widget-text-only ${style?.showAlert ? 'mini-widget-alert' : ''}`}
      style={getCardStyle()}
      data-element-id={data.id}
    >
      <div className="mini-widget-text-content">
        <div className="mini-widget-title pelago-body-1-bold">{resolvedTitle}</div>
        {resolvedContent && (
          <div className="mini-widget-subtitle pelago-body-2-regular">{resolvedContent}</div>
        )}
      </div>
    </div>
  );
};

export default MiniWidgetElement;

