import React from 'react';
import './OvalAnimation.css';

interface OvalAnimationProps {
  isAnimating: boolean;
  shape?: 'oval' | 'rectangle';
  substance?: string | null;
}

export default function OvalAnimation({ 
  isAnimating, 
  shape = 'oval',
  substance = null 
}: OvalAnimationProps) {
  return (
    <div className="oval-container">
      <div className={`oval-animation ${isAnimating ? 'active' : ''} ${shape}`}>
        <div className="oval-inner">
          <div className="oval-pulse"></div>
          {substance && (
            <div className="oval-substance">
              {substance}
            </div>
          )}
        </div>
      </div>
      {isAnimating && (
        <p className="oval-status">Listening...</p>
      )}
    </div>
  );
}
