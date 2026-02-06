import React from 'react';
import './ImageCarouselElement.css';

export interface ImageCarouselElementProps {
  data: {
    id: string;
    images: Array<{
      imageUrl: string;
      title: string;
      subtitle?: string;
    }>;
  };
  style?: {
    speed?: number;
    height?: number;
    gap?: number;
    pauseOnHover?: boolean;
  };
}

export const ImageCarouselElement: React.FC<ImageCarouselElementProps> = ({
  data,
  style,
}) => {
  const images = data.images || [];
  const speed = Math.max(style?.speed || 30, 1);
  const cardHeight = style?.height || 160;
  const gap = style?.gap || 16;
  const pauseOnHover = style?.pauseOnHover !== false;

  if (images.length === 0) {
    return (
      <div className="image-carousel-empty" data-element-id={data.id}>
        No images configured
      </div>
    );
  }

  const duplicatedImages = [...images, ...images];

  const cardWidth = Math.round(cardHeight * 0.85);
  const singleSetWidth = images.length * cardWidth + (images.length - 1) * gap;
  const scrollDistance = singleSetWidth + gap;
  const duration = scrollDistance / speed;

  return (
    <div
      className={`image-carousel-container ${pauseOnHover ? 'image-carousel-pause-hover' : ''}`}
      data-element-id={data.id}
      style={{
        '--carousel-duration': `${duration}s`,
        '--carousel-gap': `${gap}px`,
        '--carousel-card-width': `${cardWidth}px`,
        '--carousel-scroll-distance': `${scrollDistance}px`,
      } as React.CSSProperties}
    >
      <div className="image-carousel-track">
        {duplicatedImages.map((image, index) => (
          <div
            key={`${image.title}-${index}`}
            className="image-carousel-card"
          >
            <div className="image-carousel-card-image-wrapper" style={{ height: `${cardHeight}px` }}>
              <img
                src={image.imageUrl}
                alt={image.title}
                className="image-carousel-card-image"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
            <div className="image-carousel-card-info">
              <span className="image-carousel-card-title">{image.title}</span>
              {image.subtitle && (
                <span className="image-carousel-card-subtitle">{image.subtitle}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageCarouselElement;
