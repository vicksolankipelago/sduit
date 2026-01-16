import React from 'react';
import { TextCardElementState, TextCardElementStyle } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import { useScreenContext } from '../../../contexts/voiceAgent/ScreenContext';
import './TextCardElement.css';

export interface TextCardElementProps {
  data: TextCardElementState;
  style?: TextCardElementStyle;
}

// Green filled circle with white checkmark - matches iOS TickWithContainer component
const CheckmarkIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="8" fill="#4CAF50"/>
    <path
      d="M5 8L7 10L11 6"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TextCardElement: React.FC<TextCardElementProps> = ({
  data,
  style,
}) => {
  const { interpolateString } = useScreenContext();
  const caption = interpolateString(data.title ?? '');
  const content = interpolateString(data.content ?? '');

  const backgroundColorVar = mapIOSColorToCSSVar(style?.backgroundColor ?? 'backgroundLightTeaGreen');
  const borderColorVar = mapIOSColorToCSSVar(style?.borderColor ?? 'backgroundMintGreen');
  const textColorVar = mapIOSColorToCSSVar(style?.textColor ?? 'textGlobalPrimary');
  const captionColorVar = mapIOSColorToCSSVar(style?.captionColor ?? 'textGlobalSecondary');
  const borderWidth = style?.borderWidth ?? 1;
  const cornerRadius = style?.cornerRadius ?? 8;
  const showCheckmark = style?.showCheckmark ?? false;

  const cardStyle: React.CSSProperties = {
    backgroundColor: `var(${backgroundColorVar})`,
    borderColor: `var(${borderColorVar})`,
    borderWidth: `${borderWidth}px`,
    borderStyle: 'solid',
    borderRadius: `${cornerRadius}px`,
  };

  const captionStyle: React.CSSProperties = {
    color: `var(${captionColorVar})`,
  };

  const textStyle: React.CSSProperties = {
    color: `var(${textColorVar})`,
  };

  // If showCheckmark is true, use horizontal layout with checkmark
  if (showCheckmark) {
    return (
      <div
        className="text-card-element text-card-element-with-checkmark"
        style={cardStyle}
        data-element-id={data.id}
      >
        <div className="text-card-checkmark">
          <CheckmarkIcon />
        </div>
        <div className="text-card-content-wrapper">
          {caption && (
            <div className="text-card-caption pelago-caption-2-regular" style={captionStyle}>
              {caption}
            </div>
          )}
          <div className="text-card-text pelago-body-1-regular" style={textStyle}>
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="text-card-element"
      style={cardStyle}
      data-element-id={data.id}
    >
      {caption && (
        <div className="text-card-caption pelago-caption-2-regular" style={captionStyle}>
          {caption}
        </div>
      )}
      <div className="text-card-text pelago-header-2" style={textStyle}>
        {content}
      </div>
    </div>
  );
};

export default TextCardElement;
