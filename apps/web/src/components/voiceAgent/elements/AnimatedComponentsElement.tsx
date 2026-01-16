import React, { useState, useEffect } from 'react';
import { AnimatedComponentsData, AnimatedComponentsElementStyle } from '../../../types/journey';
import { getElementComponent } from '../../../lib/voiceAgent/elementRegistry';
import { useScreenContext } from '../../../contexts/voiceAgent/ScreenContext';
import './AnimatedComponentsElement.css';

export interface AnimatedComponentsElementProps {
  data: AnimatedComponentsData;
  style?: AnimatedComponentsElementStyle;
  renderElement?: (element: any, index: number) => React.ReactNode;
  onEventTrigger?: (eventId: string) => void;
}

export const AnimatedComponentsElement: React.FC<AnimatedComponentsElementProps> = ({
  data,
  style,
  renderElement,
  onEventTrigger,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { interpolateString, evaluateConditions } = useScreenContext();

  useEffect(() => {
    if (style?.autoStart && data.elements.length > 1) {
      const duration = (style.duration || 2) * 1000;
      const interval = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= data.elements.length) {
            if (style.loop) {
              return 0;
            }
            clearInterval(interval);
            return prev;
          }
          return next;
        });
      }, duration);

      return () => clearInterval(interval);
    }
  }, [data.elements.length, style]);

  const currentElement = data.elements[currentIndex];

  // Render element using element registry
  const renderChildElement = (element: any) => {
    if (renderElement) {
      return renderElement(element, currentIndex);
    }

    // Filter elements based on conditions
    if (element.conditions && element.conditions.length > 0) {
      const shouldShow = evaluateConditions(element.conditions);
      if (!shouldShow) {
        return null;
      }
    }

    const Component = getElementComponent(element.type as any);
    if (!Component) {
      return null;
    }

    // Interpolate text fields in state
    const interpolatedData = { ...element.state };
    if (typeof interpolatedData.text === 'string') {
      interpolatedData.text = interpolateString(interpolatedData.text);
    }
    if (typeof interpolatedData.title === 'string') {
      interpolatedData.title = interpolateString(interpolatedData.title);
    }
    if (typeof interpolatedData.description === 'string') {
      interpolatedData.description = interpolateString(interpolatedData.description);
    }
    if (typeof interpolatedData.message === 'string') {
      interpolatedData.message = interpolateString(interpolatedData.message);
    }

    return (
      <Component
        data={interpolatedData}
        style={element.style}
        events={element.events}
        onEventTrigger={onEventTrigger}
      />
    );
  };

  return (
    <div 
      className="animated-components-element"
      data-element-id={data.id}
    >
      {currentElement && renderChildElement(currentElement)}
    </div>
  );
};

export default AnimatedComponentsElement;

