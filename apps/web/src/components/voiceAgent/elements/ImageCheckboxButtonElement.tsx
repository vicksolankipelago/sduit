import React, { useState } from 'react';
import { ImageCheckboxButtonElementState, ImageCheckboxButtonElementStyle, ScreenEvent } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './ImageCheckboxButtonElement.css';

export interface ImageCheckboxButtonElementProps {
  data: ImageCheckboxButtonElementState;
  style?: ImageCheckboxButtonElementStyle;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
}

export const ImageCheckboxButtonElement: React.FC<ImageCheckboxButtonElementProps> = ({
  data,
  style: _style,
  events,
  onEventTrigger,
}) => {
  const [isSelected, setIsSelected] = useState(data.isSelected || false);

  const handleToggle = () => {
    const newValue = !isSelected;
    setIsSelected(newValue);

    const event = events?.find(e => e.type === 'onSelected');
    if (event && onEventTrigger) {
      onEventTrigger(event.id);
    }
  };

  const getBackgroundColor = (): string => {
    const cssVar = mapIOSColorToCSSVar(data.backgroundColor);
    return `var(${cssVar})`;
  };

  return (
    <button
      className={`image-checkbox-button-element ${isSelected ? 'selected' : ''}`}
      onClick={handleToggle}
      style={{ backgroundColor: getBackgroundColor() }}
      data-element-id={data.id}
    >
      <div className="image-checkbox-button-image">
        {/* Image placeholder */}
        🎨
      </div>
      <div className="image-checkbox-button-content">
        <div className="image-checkbox-button-title pelago-body-1-bold">
          {data.title}
        </div>
        {data.caption && (
          <div className="image-checkbox-button-caption pelago-body-2-regular">
            {data.caption}
          </div>
        )}
      </div>
      {isSelected && (
        <div className="image-checkbox-button-check">✓</div>
      )}
    </button>
  );
};

export default ImageCheckboxButtonElement;

