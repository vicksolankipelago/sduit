import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { AnimatedImageElementState, AnimatedImageElementStyle } from '../../../types/journey';
import './AnimatedImageElement.css';

// Default placeholder animation
const DEFAULT_PLACEHOLDER_ANIMATION = 'COLOR_Pelago_WalkWithPhone';

export interface AnimatedImageElementProps {
  data: AnimatedImageElementState;
  style?: AnimatedImageElementStyle;
}

export const AnimatedImageElement: React.FC<AnimatedImageElementProps> = ({
  data,
  style,
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [placeholderData, setPlaceholderData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  useEffect(() => {
    // Reset state when animation changes
    setAnimationData(null);
    setError(false);
    setIsPlaceholder(false);

    // If no animation name, load placeholder animation
    if (!data.lottieName) {
      setIsPlaceholder(true);
      loadPlaceholderAnimation();
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
        // Try to load placeholder on error
        loadPlaceholderAnimation();
      }
    };

    loadAnimation();
  }, [data.lottieName]);

  const loadPlaceholderAnimation = async () => {
    if (placeholderData) return; // Already loaded
    try {
      const response = await fetch(`/animations/${DEFAULT_PLACEHOLDER_ANIMATION}.json`);
      if (response.ok) {
        const json = await response.json();
        setPlaceholderData(json);
      }
    } catch (err) {
      console.error('Failed to load placeholder animation:', err);
    }
  };

  // Show placeholder animation when no animation selected or error occurred
  if (isPlaceholder || (error && !animationData)) {
    return (
      <div 
        className="animated-image-element animated-image-placeholder-container"
        style={{
          width: style?.width ? `${style.width}px` : '200px',
          height: style?.height ? `${style.height}px` : '200px',
        }}
        data-element-id={data.id}
      >
        {placeholderData ? (
          <Lottie
            animationData={placeholderData}
            loop={true}
            autoplay={true}
            style={{
              width: '100%',
              height: '100%',
              opacity: 0.5,
            }}
          />
        ) : (
          <div className="animated-image-placeholder">
            {error ? '⚠️' : '⏳'} {data.lottieName || 'animation'}
          </div>
        )}
      </div>
    );
  }

  // Still loading
  if (!animationData) {
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
          ⏳ Loading...
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

