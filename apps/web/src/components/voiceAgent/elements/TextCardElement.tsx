import React from 'react';
import { TextCardElementState, TextCardElementStyle } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import { useScreenContext } from '../../../contexts/voiceAgent/ScreenContext';
import './TextCardElement.css';

export interface TextCardElementProps {
  data: TextCardElementState;
  style?: TextCardElementStyle;
}

const CheckmarkIcon: React.FC<{ backgroundColorVar: string; checkColorVar: string }> = ({
  backgroundColorVar,
  checkColorVar,
}) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="11" fill={`var(${backgroundColorVar})`} />
    <path
      d="M7 11L9.5 13.5L15 8.5"
      stroke={`var(${checkColorVar})`}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FallbackIcon: React.FC<{
  iconName: string;
  backgroundColorVar: string;
  iconColorVar: string;
}> = ({ iconName, backgroundColorVar, iconColorVar }) => {
  const glyph = iconName.trim().charAt(0).toUpperCase() || '?';

  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="11" fill={`var(${backgroundColorVar})`} />
      <text
        x="11"
        y="14"
        textAnchor="middle"
        fill={`var(${iconColorVar})`}
        fontSize="11"
        fontFamily="ES Rebond Grotesque, sans-serif"
        fontWeight="700"
      >
        {glyph}
      </text>
    </svg>
  );
};

const TextCardIcon: React.FC<{
  iconName: string;
  backgroundColorVar: string;
  iconColorVar: string;
}> = ({ iconName, backgroundColorVar, iconColorVar }) => {
  const normalizedIconName = iconName.trim().toLowerCase();

  switch (normalizedIconName) {
    case 'check':
    case 'checkmark':
    case 'tick':
      return (
        <CheckmarkIcon
          backgroundColorVar={backgroundColorVar}
          checkColorVar={iconColorVar}
        />
      );
    default:
      return (
        <FallbackIcon
          iconName={iconName}
          backgroundColorVar={backgroundColorVar}
          iconColorVar={iconColorVar}
        />
      );
  }
};

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
  const borderWidth = style?.borderWidth ?? 1;
  const cornerRadius = style?.cornerRadius ?? 8;

  // New icon API with legacy fallback support.
  const hasConfiguredIconName = typeof style?.iconName === 'string' && style.iconName.trim().length > 0;
  const shouldRenderIcon = style?.showIcon ?? style?.showCheckmark ?? hasConfiguredIconName;
  const iconName = style?.iconName?.trim() || 'checkmark';

  // New title style API with a sensible default for icon-based cards.
  const titleTextStyle = style?.titleTextStyle ?? (shouldRenderIcon ? 'boldBlack' : 'default');
  const captionDefaultColor = titleTextStyle === 'boldBlack' ? 'textGlobalPrimary' : 'textGlobalSecondary';
  const captionColorVar = mapIOSColorToCSSVar(style?.captionColor ?? captionDefaultColor);

  const iconBackgroundColorVar = mapIOSColorToCSSVar(
    style?.iconBackgroundColor ?? style?.checkmarkBackgroundColor ?? 'primaryCTADefault'
  );
  const iconColorVar = mapIOSColorToCSSVar(
    style?.iconColor ?? style?.checkmarkColor ?? 'textGlobalLight'
  );

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

  const captionTypographyClass =
    titleTextStyle === 'boldBlack' ? 'pelago-body-2-bold' : 'pelago-caption-2-regular';
  const contentTypographyClass = 'pelago-body-2-regular';

  return (
    <div
      className={`text-card-element ${shouldRenderIcon ? 'text-card-element-with-icon' : ''}`}
      style={cardStyle}
      data-element-id={data.id}
    >
      {shouldRenderIcon && (
        <div className="text-card-leading-icon">
          <TextCardIcon
            iconName={iconName}
            backgroundColorVar={iconBackgroundColorVar}
            iconColorVar={iconColorVar}
          />
        </div>
      )}
      <div className="text-card-content-wrapper">
        {caption && (
          <div className={`text-card-caption ${captionTypographyClass}`} style={captionStyle}>
            {caption}
          </div>
        )}
        <div className={`text-card-text ${contentTypographyClass}`} style={textStyle}>
          {content}
        </div>
      </div>
    </div>
  );
};

export default TextCardElement;
