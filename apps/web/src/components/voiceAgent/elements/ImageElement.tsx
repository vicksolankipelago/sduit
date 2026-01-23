import React from 'react';
import { ImageElementState, ImageElementStyle } from '../../../types/journey';
import './ImageElement.css';

export interface ImageElementProps {
  data: ImageElementState;
  style?: ImageElementStyle;
}

export const ImageElement: React.FC<ImageElementProps> = ({
  data,
  style,
}) => {
  const getImageSrc = (): string => {
    // Support both legacy .png in images folder and new .svg in illustrations folder
    const imageName = data.imageName;
    if (imageName.startsWith('Colour') || imageName.startsWith('Mono')) {
      return `/illustrations/${imageName}.svg`;
    }
    return `/images/${imageName}.png`;
  };

  const getImageClassName = (): string => {
    const baseClass = 'image-element';
    const contentModeClass = style?.contentMode === 'fill' 
      ? 'image-element-fill' 
      : 'image-element-fit';
    
    return `${baseClass} ${contentModeClass}`.trim();
  };

  const getImageStyle = (): React.CSSProperties => {
    return {
      width: style?.width ? `${style.width}px` : undefined,
      height: style?.height ? `${style.height}px` : undefined,
    };
  };

  return (
    <div 
      className="image-element-container"
      data-element-id={data.id}
    >
      <img
        src={getImageSrc()}
        alt={data.imageName}
        className={getImageClassName()}
        style={getImageStyle()}
        onError={(e) => {
          // Fallback to placeholder on error
          const target = e.target as HTMLImageElement;
          target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3EImage%3C/text%3E%3C/svg%3E';
        }}
      />
    </div>
  );
};

export default ImageElement;

