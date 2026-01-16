import React from 'react';
import { SpacerElementState, SpacerElementStyle } from '../../../types/journey';
import './SpacerElement.css';

export interface SpacerElementProps {
  data: SpacerElementState;
  style?: SpacerElementStyle;
}

export const SpacerElement: React.FC<SpacerElementProps> = ({
  data,
  style,
}) => {
  const getSpacerClassName = (): string => {
    const baseClass = 'spacer-element';
    const flexClass = style?.isFlexible ? 'spacer-element-flexible' : 'spacer-element-fixed';
    const directionClass = style?.direction === 'horizontal' 
      ? 'spacer-element-horizontal' 
      : 'spacer-element-vertical';
    
    return `${baseClass} ${flexClass} ${directionClass}`.trim();
  };

  const getSpacerStyle = (): React.CSSProperties => {
    // If height is null or undefined, make it flexible (fills space)
    const isFlexible = style?.height == null;
    
    if (isFlexible) {
      return {
        flex: 1,
        minHeight: 0,
      };
    }

    return {
      width: style?.width != null ? `${style.width}px` : undefined,
      height: style?.height != null ? `${style.height}px` : undefined,
      flexShrink: 0,
      flexGrow: 0,
    };
  };

  return (
    <div
      className={getSpacerClassName()}
      style={getSpacerStyle()}
      data-element-id={data.id}
    />
  );
};

export default SpacerElement;

