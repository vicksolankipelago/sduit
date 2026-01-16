import React from 'react';
import { ImageCardElementState, ImageCardElementStyle } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './ImageCardElement.css';

export interface ImageCardElementProps {
  data: ImageCardElementState;
  style: ImageCardElementStyle;
  interpolatedTitle?: string;
  interpolatedDescription?: string;
}

export const ImageCardElement: React.FC<ImageCardElementProps> = ({
  data,
  style,
  interpolatedTitle,
  interpolatedDescription,
}) => {
  const title = interpolatedTitle || data.title;
  const description = interpolatedDescription || data.description;

  const getCardStyle = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};
    
    if (style.backgroundColor) {
      const cssVar = mapIOSColorToCSSVar(style.backgroundColor);
      styles.backgroundColor = `var(${cssVar})`;
    }
    
    if (style.cornerRadius) {
      styles.borderRadius = `${style.cornerRadius}px`;
    }
    
    return styles;
  };

  const getImageSrc = (): string => {
    return `/assets/images/${style.imageName}.png`;
  };

  return (
    <div 
      className="image-card-element"
      style={getCardStyle()}
      data-element-id={data.id}
    >
      {style.imageName && (
        <img
          src={getImageSrc()}
          alt={title}
          className="image-card-image"
          style={{
            width: style.imageWidth ? `${style.imageWidth}px` : undefined,
            height: style.imageHeight ? `${style.imageHeight}px` : undefined,
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      )}
      <div className="image-card-content">
        <div className="image-card-title pelago-body-1-bold">
          {title}
        </div>
        <div className="image-card-description pelago-body-1-regular">
          {description}
        </div>
      </div>
    </div>
  );
};

export default ImageCardElement;

