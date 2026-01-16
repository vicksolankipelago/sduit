import React from 'react';
import { TextBlockElementState, TextBlockElementStyle } from '../../../types/journey';
import { mapIOSFontToClassName, mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './TextBlockElement.css';

export interface TextBlockElementProps {
  data: TextBlockElementState;
  style: TextBlockElementStyle;
  interpolatedText?: string; // Pre-interpolated text from state manager
}

export const TextBlockElement: React.FC<TextBlockElementProps> = ({
  data,
  style,
  interpolatedText,
}) => {
  const text = interpolatedText || data.text;
  
  const getFontClassName = (): string => {
    return mapIOSFontToClassName(style.style);
  };

  const getAlignmentClass = (): string => {
    switch (style.alignment) {
      case 'center':
        return 'text-align-center';
      case 'trailing':
        return 'text-align-right';
      case 'leading':
      default:
        return 'text-align-left';
    }
  };

  const getColorStyle = (): React.CSSProperties => {
    if (style.color) {
      const cssVar = mapIOSColorToCSSVar(style.color);
      return { color: `var(${cssVar})` };
    }
    return {};
  };

  return (
    <div
      className={`text-block-element ${getFontClassName()} ${getAlignmentClass()}`}
      style={getColorStyle()}
      data-element-id={data.id}
    >
      {text}
    </div>
  );
};

export default TextBlockElement;

