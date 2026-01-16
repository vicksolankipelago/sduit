import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { AnimatedImageElementState, AnimatedImageElementStyle } from '../../../types/journey';
import './AnimatedImageElement.css';

export interface AnimatedImageElementProps {
  data: AnimatedImageElementState;
  style?: AnimatedImageElementStyle;
}

export const AnimatedImageElement: React.FC<AnimatedImageElementProps> = ({
  data,
  style,
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset state when animation changes
    setAnimationData(null);
    setError(false);

    // Don't try to load if no animation name
    if (!data.lottieName) {
      setError(true);
      return;
    }

    // Load the Lottie animation file
    const loadAnimation = async () => {
      try {
        console.log('🎬 Loading Lottie animation:', data.lottieName);
        const response = await fetch(`/animations/${data.lottieName}.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const json = await response.json();
        console.log('✅ Lottie animation loaded successfully:', data.lottieName);
        setAnimationData(json);
      } catch (err) {
        console.error('❌ Failed to load Lottie animation:', data.lottieName, err);
        setError(true);
      }
    };

    loadAnimation();
  }, [data.lottieName]);

  if (error || !animationData) {
    return (
      <div 
        className="animated-image-element"
        style={{
          width: style?.width ? `${style.width}px` : '200px',
          height: style?.height ? `${style.height}px` : '200px',
        }}
        data-element-id={data.id}
      >
        <div className="animated-image-placeholder">
          {error ? '⚠️' : '⏳'} {data.lottieName}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="animated-image-element"
      style={{
        width: style?.width ? `${style.width}px` : '200px',
        height: style?.height ? `${style.height}px` : '200px',
      }}
      data-element-id={data.id}
    >
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};

export default AnimatedImageElement;

